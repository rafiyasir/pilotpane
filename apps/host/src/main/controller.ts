/**
 * The host's brain: owns the state, the LAN server, pairing, viewer sessions,
 * the capture engine window and the UI windows, and wires them together.
 */
import { BrowserWindow, app, ipcMain } from 'electron';
import { hostname } from 'node:os';
import type { EngineCommand, EngineEvent, HostAction, HostState, QualityPreset } from '@pilotpane/protocol';
import { isQualityPreset, isThemeName } from '@pilotpane/protocol';
import { HostStateStore } from './host-state.js';
import { createLogger } from './log.js';
import { LanServer } from './net/http-server.js';
import { listLanAddresses } from './net/lan.js';
import { Pairing } from './pairing.js';
import type { InputInjector } from './platform/input-injector.js';
import type { KeepAwake } from './platform/keep-awake.js';
import type { PowerEvents } from './platform/power.js';
import type { ScreenCapturer } from './platform/screen-capturer.js';
import { InputBridge } from './input-bridge.js';
import { ViewerSessions } from './session.js';
import { applyUpdate } from './updater/apply.js';
import { Updater, type UpdaterOptions } from './updater/updater.js';
import { saveSettings, type Settings } from './settings.js';
import { HostTray } from './tray.js';
import { createEngineWindow, createHostWindow, createPinWindow, type WindowPaths } from './windows.js';

const log = createLogger('host');
const NETWORK_POLL_MS = 3000;

export interface ControllerOptions {
  settings: Settings;
  settingsFile: string;
  viewerDir: string;
  protocolDir: string;
  windows: WindowPaths;
  trayIcon: string;
  capturer: ScreenCapturer;
  injector: InputInjector;
  keepAwake: KeepAwake;
  power: PowerEvents;
  update: UpdateServices;
}

/** Everything the updater needs from the outside world. Built in main.ts. */
export interface UpdateServices {
  updater: Omit<UpdaterOptions, 'currentVersion' | 'onState'>;
  /** The installed PilotPane.exe to start again after an update. */
  relaunchPath: string;
  /** False when running from source: the installer must not replace a dev checkout. */
  canInstall: boolean;
  spawn(command: string, args: string[]): void;
}

export class HostController {
  private readonly pairing = new Pairing();
  private readonly sessions: ViewerSessions;
  private readonly input: InputBridge;
  private server: LanServer;
  private readonly store: HostStateStore;
  private readonly updater: Updater;
  private paused = false;
  private quitting = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private lockTimer: NodeJS.Timeout | null = null;

  private hostWindow: BrowserWindow | null = null;
  private pinWindow: BrowserWindow | null = null;
  private engineWindow: BrowserWindow | null = null;
  private tray: HostTray | null = null;

  constructor(private readonly opts: ControllerOptions) {
    this.store = new HostStateStore({
      status: 'starting',
      appVersion: app.getVersion(),
      hostName: hostname(),
      pin: this.pairing.pin,
      port: opts.settings.port,
      addresses: [],
      theme: opts.settings.theme,
      quality: opts.settings.quality,
      viewer: null,
      stats: null,
      lockedUntil: null,
      message: null,
      update: { phase: 'idle' }
    });

    this.updater = new Updater({
      ...opts.update.updater,
      currentVersion: this.state.appVersion,
      onState: (update) => this.patch({ update })
    });

    this.input = new InputBridge(opts.injector);
    this.sessions = new ViewerSessions(this.pairing, {
      hostName: this.state.hostName,
      appVersion: this.state.appVersion,
      onPaired: (viewer) => {
        this.patch({ status: 'connecting', viewer, stats: null, message: null });
        this.closePinWindow();
        this.sessions.toViewer({ type: 'input-state', available: this.input.available });
        void this.startEngine();
      },
      onViewerGone: () => {
        this.input.end();
        this.engine({ cmd: 'stop' });
        this.opts.keepAwake.stop();
        this.patch({ status: this.paused ? 'paused' : 'ready', viewer: null, stats: null });
      },
      onAnswer: (sdp) => this.engine({ cmd: 'answer', sdp }),
      onIce: (candidate) => this.engine({ cmd: 'ice', candidate }),
      onQuality: (preset) => this.setQuality(preset),
      onStats: (stats) => this.patch({ stats }),
      onLockChange: () => this.refreshLock()
    });

    this.server = this.makeServer(this.state.port);
  }

  private get state(): HostState {
    return this.store.state;
  }

  start(): void {
    this.store.subscribe((state) => {
      for (const win of [this.hostWindow, this.pinWindow]) {
        if (win && !win.isDestroyed()) win.webContents.send('pp:state', state);
      }
      this.tray?.update(state);
    });
    ipcMain.handle('pp:get-state', () => this.state);
    ipcMain.on('pp:act', (event, action: HostAction) => {
      if (!this.isOurWindow(event.sender.id, [this.hostWindow, this.pinWindow])) return;
      this.handleAction(action);
    });
    ipcMain.on('pp:engine-evt', (event, evt: EngineEvent) => {
      if (!this.isOurWindow(event.sender.id, [this.engineWindow])) return;
      this.handleEngineEvent(evt);
    });

    this.opts.capturer.serveDisplayRequests(
      (frameUrl) =>
        !!this.engineWindow && !this.engineWindow.isDestroyed() && frameUrl.startsWith('app://bundle/engine/')
    );
    this.engineWindow = createEngineWindow(this.opts.windows);
    this.tray = new HostTray(
      this.opts.trayIcon,
      (a) => this.handleAction(a),
      () => this.showHostWindow()
    );
    this.showHostWindow();
    this.showPinWindow();

    this.opts.power.onSuspend(() => {
      log.info('going to sleep, closing the viewer link');
      this.sessions.dropActive('host asleep');
    });
    this.opts.power.onResume(() => {
      log.info('woke up, checking the network now');
      this.pollNetwork();
    });

    this.pollNetwork();
    this.pollTimer = setInterval(() => this.pollNetwork(), NETWORK_POLL_MS);
  }

  /** Called from app 'before-quit'. */
  shutdown(): void {
    this.quitting = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.sessions.kick('host-stopped');
    this.server.closeAll();
    this.opts.keepAwake.stop();
    this.opts.injector.dispose();
    this.tray?.destroy();
  }

  /** A second launch of the app brings both windows back. */
  bringToFront(): void {
    this.showHostWindow();
    if (!this.state.viewer) this.showPinWindow();
  }

  showHostWindow(): void {
    if (this.hostWindow && !this.hostWindow.isDestroyed()) {
      this.hostWindow.show();
      this.hostWindow.focus();
      return;
    }
    const win = createHostWindow(this.opts.windows, this.state.theme);
    win.on('close', (e) => {
      if (!this.quitting) {
        // Closing the window only hides it; the host keeps sharing from the tray.
        e.preventDefault();
        win.hide();
      }
    });
    this.hostWindow = win;
  }

  // ---------- state ----------

  private patch(partial: Partial<HostState>): void {
    this.store.patch(partial);
  }

  private refreshLock(): void {
    const lockedUntil = this.pairing.lockedUntil;
    this.patch({ lockedUntil });
    if (this.lockTimer) clearTimeout(this.lockTimer);
    if (lockedUntil) this.lockTimer = setTimeout(() => this.refreshLock(), lockedUntil - Date.now() + 50);
  }

  // ---------- network ----------

  private makeServer(port: number): LanServer {
    return new LanServer({
      port,
      roots: [
        { prefix: '/protocol/', dir: this.opts.protocolDir },
        { prefix: '/', dir: this.opts.viewerDir }
      ],
      onSocket: (conn, info) => {
        if (this.paused) {
          conn.close(1000, 'paused');
          return;
        }
        this.sessions.accept(conn, info);
      },
      onListenError: (address, err) => {
        if (err.code === 'EADDRINUSE') {
          log.error(`port ${port} is busy on ${address}`);
          this.server.closeAll();
          this.patch({ status: 'port-busy', message: `Port ${port} is already in use.` });
        } else {
          log.error(`could not listen on ${address}`, err);
        }
      }
    });
  }

  private pollNetwork(): void {
    if (this.state.status === 'port-busy') return;
    const lan = listLanAddresses();
    const visible = lan.filter((a) => a.kind !== 'loopback');
    const listenOn = this.paused ? [] : [...visible.map((a) => a.address), '127.0.0.1'];
    this.server.sync(listenOn);

    const changed = JSON.stringify(visible) !== JSON.stringify(this.state.addresses);
    let status = this.state.status;
    if (status === 'starting' || status === 'no-network' || status === 'ready') {
      status = this.paused ? 'paused' : visible.length === 0 ? 'no-network' : 'ready';
    }
    if (changed || status !== this.state.status) {
      if (changed) log.info(`LAN addresses: ${visible.map((a) => `${a.iface}=${a.address}`).join(', ') || 'none'}`);
      this.patch({ addresses: visible, status });
    }
  }

  // ---------- actions from the UI and tray ----------

  private handleAction(action: HostAction): void {
    switch (action.action) {
      case 'new-pin':
        this.pairing.newPin();
        this.sessions.kick('new-pin');
        this.patch({ pin: this.pairing.pin, lockedUntil: null });
        return;
      case 'disconnect-viewer':
        this.sessions.kick('kicked');
        return;
      case 'pause':
        this.paused = true;
        this.sessions.kick('host-stopped');
        this.server.sync([]);
        this.patch({ status: 'paused' });
        return;
      case 'resume':
        this.paused = false;
        this.patch({ status: 'ready' });
        this.pollNetwork();
        return;
      case 'show-pin-screen':
        this.showPinWindow();
        return;
      case 'hide-pin-screen':
        this.closePinWindow();
        return;
      case 'set-theme':
        if (!isThemeName(action.theme)) return;
        this.patch({ theme: action.theme });
        this.persist();
        return;
      case 'use-next-port': {
        const port = this.state.port >= 65535 ? 1024 : this.state.port + 1;
        this.server.closeAll();
        this.server = this.makeServer(port);
        this.patch({ port, status: 'starting', message: null });
        this.persist();
        this.pollNetwork();
        return;
      }
      case 'check-for-updates':
        this.showHostWindow(); // the result shows in the host window
        void this.updater.check();
        return;
      case 'download-update':
        void this.updater.download();
        return;
      case 'install-update':
        this.installUpdate();
        return;
      case 'dismiss-update':
        this.updater.dismiss();
        return;
      case 'quit':
        app.quit();
        return;
    }
  }

  private installUpdate(): void {
    const installerPath = this.updater.readyInstaller;
    if (!installerPath) return;
    const { canInstall, relaunchPath, spawn } = this.opts.update;
    if (!canInstall) {
      log.warn('updates can only be installed in the installed app');
      this.updater.markFailed('install-failed');
      return;
    }
    try {
      applyUpdate({ installerPath, relaunchPath, spawn, quit: () => app.quit() });
    } catch (err) {
      log.error('could not start the installer', err);
      this.updater.markFailed('install-failed');
    }
  }

  private persist(): void {
    saveSettings(this.opts.settingsFile, {
      port: this.state.port,
      theme: this.state.theme,
      quality: this.state.quality
    });
  }

  private setQuality(preset: QualityPreset): void {
    if (!isQualityPreset(preset)) return;
    this.patch({ quality: preset });
    this.persist();
    this.engine({ cmd: 'quality', preset });
    this.sessions.toViewer({ type: 'quality', preset });
  }

  // ---------- capture engine ----------

  private engine(command: EngineCommand): void {
    const win = this.engineWindow;
    if (win && !win.isDestroyed()) win.webContents.send('pp:engine-cmd', command);
  }

  private async startEngine(): Promise<void> {
    try {
      const source = await this.opts.capturer.pickPrimary();
      if (!source) throw new Error('no screen to capture');
      log.info(`capturing "${source.name}"`);
      this.engine({ cmd: 'start', sourceId: source.id, quality: this.state.quality });
    } catch (err) {
      log.error('could not start capture', err);
      this.sessions.kick('capture-failed');
      this.patch({ status: 'error', message: 'Could not capture the screen.' });
    }
  }

  private handleEngineEvent(evt: EngineEvent): void {
    switch (evt.evt) {
      case 'offer':
        this.sessions.toViewer({ type: 'offer', sdp: evt.sdp });
        return;
      case 'ice':
        this.sessions.toViewer({ type: 'ice', candidate: evt.candidate });
        return;
      case 'connection':
        log.info(`peer connection: ${evt.state}`);
        if (evt.state !== 'connected' && evt.state !== 'connecting') this.input.end();
        if (evt.state === 'connected' && this.sessions.hasViewer) {
          this.patch({ status: 'streaming' });
          this.opts.keepAwake.start();
        }
        return;
      case 'stopped':
        return;
      case 'input':
        // Only the paired viewer has the data channel, but check anyway.
        if (evt.msg.type === 'key') log.debug(`key ${evt.msg.code} ${evt.msg.down ? 'down' : 'up'}`);
        if (this.sessions.hasViewer) this.input.handle(evt.msg);
        return;
      case 'debug-stats':
        log.debug(
          `send: ${evt.frameWidth}px ${evt.framesPerSecond} fps, target ${Math.round(evt.targetBitrate / 1000)} kbps, limited by ${evt.qualityLimitationReason}`
        );
        return;
      case 'error':
        log.error(`engine: ${evt.message}`);
        this.sessions.kick('capture-failed');
        this.patch({ message: evt.message });
        return;
    }
  }

  // ---------- windows ----------

  private showPinWindow(): void {
    if (this.pinWindow && !this.pinWindow.isDestroyed()) {
      this.pinWindow.show();
      this.pinWindow.focus();
      return;
    }
    const win = createPinWindow(this.opts.windows, this.state.theme);
    win.on('closed', () => {
      if (this.pinWindow === win) this.pinWindow = null;
    });
    this.pinWindow = win;
  }

  private closePinWindow(): void {
    if (this.pinWindow && !this.pinWindow.isDestroyed()) this.pinWindow.close();
    this.pinWindow = null;
  }

  private isOurWindow(senderId: number, wins: Array<BrowserWindow | null>): boolean {
    return wins.some((w) => w !== null && !w.isDestroyed() && w.webContents.id === senderId);
  }
}
