import type { HostState, PilotpaneBridge, ThemeName } from '/protocol/index.js';

/** The API exposed by the preload script. */
export const api = (window as unknown as { pilotpane: PilotpaneBridge }).pilotpane;

export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
}

export function formatPin(pin: string): string {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}

export function viewerUrl(state: HostState, address?: string): string {
  const a = address ?? state.addresses[0]?.address ?? '127.0.0.1';
  return `${a}:${state.port}`;
}

export const KIND_LABEL: Record<string, string> = {
  ethernet: 'Ethernet',
  wifi: 'Wi-Fi',
  hotspot: 'Mobile hotspot',
  bluetooth: 'Bluetooth',
  virtual: 'Virtual',
  other: 'Network',
  loopback: 'This PC'
};

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
