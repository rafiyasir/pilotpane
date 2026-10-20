import { Menu, Tray, clipboard, nativeImage } from 'electron';
import type { HostAction, HostState } from '@pilotpane/protocol';

const STATUS_LABEL: Record<HostState['status'], string> = {
  starting: 'Starting',
  ready: 'Ready, waiting for a viewer',
  connecting: 'Viewer connecting',
  streaming: 'Viewer connected',
  paused: 'Sharing paused',
  'no-network': 'No local network found',
  'port-busy': 'Port is busy',
  error: 'Something went wrong'
};

export function viewerUrl(state: HostState): string | null {
  const first = state.addresses[0];
  return first ? `http://${first.address}:${state.port}` : null;
}

export function formatPin(pin: string): string {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}

export class HostTray {
  private readonly tray: Tray;

  constructor(
    iconPath: string,
    private readonly act: (action: HostAction) => void,
    private readonly openHostWindow: () => void
  ) {
    this.tray = new Tray(nativeImage.createFromPath(iconPath));
    this.tray.setToolTip('PilotPane');
    this.tray.on('double-click', () => this.act({ action: 'show-pin-screen' }));
    this.tray.on('click', () => this.openHostWindow());
  }

  update(state: HostState): void {
    const url = viewerUrl(state);
    const sharing = state.status !== 'paused';
    this.tray.setToolTip(`PilotPane: ${STATUS_LABEL[state.status]}${url ? `\n${url}` : ''}`);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: STATUS_LABEL[state.status], enabled: false },
        { label: `PIN ${formatPin(state.pin)}`, enabled: false },
        { type: 'separator' },
        { label: 'Show big PIN screen', click: () => this.act({ action: 'show-pin-screen' }) },
        { label: 'Open PilotPane', click: () => this.openHostWindow() },
        { label: 'Copy viewer address', enabled: url !== null, click: () => url && clipboard.writeText(url) },
        { label: 'New PIN', click: () => this.act({ action: 'new-pin' }) },
        { label: 'Disconnect viewer', visible: state.viewer !== null, click: () => this.act({ action: 'disconnect-viewer' }) },
        sharing
          ? { label: 'Pause sharing', click: () => this.act({ action: 'pause' }) }
          : { label: 'Resume sharing', click: () => this.act({ action: 'resume' }) },
        { type: 'separator' },
        { label: 'Quit PilotPane', click: () => this.act({ action: 'quit' }) }
      ])
    );
  }

  destroy(): void {
    this.tray.destroy();
  }
}
