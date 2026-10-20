/**
 * PilotPane host entry point (Electron main process).
 */
import { Menu, app } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAppScheme, registerAppScheme } from './app-protocol.js';
import { HostController } from './controller.js';
import { createLogger } from './log.js';
import { loadSettings, portFromArgs } from './settings.js';
import { windowPaths } from './windows.js';

const log = createLogger('main');

const mainDir = dirname(fileURLToPath(import.meta.url)); // apps/host/dist/main
const hostDist = join(mainDir, '..');
const protocolDir = dirname(fileURLToPath(import.meta.resolve('@pilotpane/protocol')));
const viewerDir = join(dirname(fileURLToPath(import.meta.resolve('@pilotpane/viewer/package.json'))), 'dist');

// Chromium hides local IPs behind random ".local" names in WebRTC. On a LAN
// with no internet (direct cable, Bluetooth) those names may not resolve, so
// PilotPane offers its real LAN addresses instead. It never uses STUN/TURN.
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
registerAppScheme();

if (!app.requestSingleInstanceLock()) {
  // A second start (e.g. double-clicking again on a broken screen) just brings
  // back the window and the PIN screen of the running instance.
  app.quit();
} else {
  let controller: HostController | null = null;

  app.on('second-instance', () => {
    controller?.bringToFront();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    handleAppScheme(join(hostDist, 'renderer'), protocolDir);

    const settingsFile = join(app.getPath('userData'), 'settings.json');
    const settings = loadSettings(settingsFile);
    const argPort = portFromArgs(process.argv);
    if (argPort) settings.port = argPort;

    controller = new HostController({
      settings,
      settingsFile,
      viewerDir,
      protocolDir,
      windows: windowPaths(mainDir),
      trayIcon: join(hostDist, 'assets', 'tray.png')
    });
    controller.start();
    log.info(`PilotPane ${app.getVersion()} started, port ${settings.port}`);
  });

  app.on('before-quit', () => controller?.shutdown());

  // Keep running in the tray when all windows are closed.
  app.on('window-all-closed', () => {
    /* stay alive */
  });
}
