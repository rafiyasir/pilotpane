import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { APP_ORIGIN } from './app-protocol.js';

export interface WindowPaths {
  preload: string;
  icon: string;
}

const BG: Record<string, string> = {
  cockpit: '#0E1726',
  daylight: '#F4F6FA',
  midnight: '#000000',
  contrast: '#000000'
};

const securePrefs = (preload: string) => ({
  preload,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webSecurity: true,
  spellcheck: false
});

/** The small control window (option A in the design). */
export function createHostWindow(paths: WindowPaths, theme: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 820,
    height: 680,
    minWidth: 640,
    minHeight: 520,
    title: 'PilotPane',
    icon: paths.icon,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: BG[theme] ?? BG.cockpit,
    webPreferences: securePrefs(paths.preload)
  });
  win.loadURL(`${APP_ORIGIN}/host/index.html`);
  win.once('ready-to-show', () => win.show());
  return win;
}

/** Full-screen PIN (option B): readable even on a faulty, jittery panel. */
export function createPinWindow(paths: WindowPaths, theme: string): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    ...display.bounds,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'PilotPane PIN',
    icon: paths.icon,
    show: false,
    backgroundColor: BG[theme] ?? BG.cockpit,
    webPreferences: securePrefs(paths.preload)
  });
  win.loadURL(`${APP_ORIGIN}/pin/pin.html`);
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  return win;
}

/** Hidden window that captures the screen and runs the WebRTC sender. */
export function createEngineWindow(paths: WindowPaths): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    width: 400,
    height: 300,
    skipTaskbar: true,
    webPreferences: { ...securePrefs(paths.preload), backgroundThrottling: false }
  });
  win.loadURL(`${APP_ORIGIN}/engine/engine.html`);
  return win;
}

export function windowPaths(mainDir: string): WindowPaths {
  return {
    preload: join(mainDir, 'preload.cjs'),
    icon: join(mainDir, '..', 'assets', 'icon-256.png')
  };
}
