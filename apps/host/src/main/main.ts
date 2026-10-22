/**
 * PilotPane host entry point (Electron main process).
 */
import { Menu, app } from 'electron';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAppScheme, registerAppScheme } from './app-protocol.js';
import { HostController } from './controller.js';
import { createLogger } from './log.js';
import { ElectronScreenCapturer } from './platform/electron-capturer.js';
import { ElectronKeepAwake } from './platform/electron-keep-awake.js';
import { HelperInputInjector } from './platform/helper-input-injector.js';
import { NullInputInjector, type InputInjector } from './platform/input-injector.js';
import { spawnHelper } from './platform/spawn-helper.js';
import { loadSettings, portFromArgs } from './settings.js';
import { DEFAULT_MANIFEST_URL, UPDATE_PUBLIC_KEY } from './updater/config.js';
import { downloadFile, fetchText } from './updater/electron-net.js';
import { inspectFile } from './updater/verify.js';
import { windowPaths } from './windows.js';

const log = createLogger('main');

const mainDir = dirname(fileURLToPath(import.meta.url)); // apps/host/dist/main
const hostDist = join(mainDir, '..');
const protocolDir = dirname(fileURLToPath(import.meta.resolve('@pilotpane/protocol')));
const viewerDir = join(dirname(fileURLToPath(import.meta.resolve('@pilotpane/viewer/package.json'))), 'dist');

/** The real injector when the helper exe was built, otherwise one that drops input. */
function createInjector(exePath: string): InputInjector {
  if (!existsSync(exePath)) {
    log.warn('input helper not found, mouse and keyboard control is off');
    return new NullInputInjector();
  }
  return new HelperInputInjector({ spawn: () => spawnHelper(exePath) });
}

/** The per-user install from the installer, or this exe when it was not installed. */
function installedExePath(): string {
  const installed = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'PilotPane', 'PilotPane.exe');
  return existsSync(installed) ? installed : process.execPath;
}

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
      trayIcon: join(hostDist, 'assets', 'tray.png'),
      capturer: new ElectronScreenCapturer(),
      injector: createInjector(join(hostDist, 'helper', 'pilotpane-input.exe')),
      keepAwake: new ElectronKeepAwake(),
      update: {
        updater: {
          manifestUrl: process.env.PILOTPANE_UPDATE_URL || DEFAULT_MANIFEST_URL,
          publicKey: UPDATE_PUBLIC_KEY,
          downloadDir: join(app.getPath('temp'), 'PilotPane-update'),
          fetchText,
          download: downloadFile,
          inspect: inspectFile,
          remove: (path) => rm(path, { force: true })
        },
        relaunchPath: installedExePath(),
        canInstall: app.isPackaged,
        spawn: (command, args) => {
          spawn(command, args, {
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
            windowsVerbatimArguments: true
          }).unref();
        }
      }
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
