import type { HostState } from '/protocol/index.js';
import { $, KIND_LABEL, api, applyTheme, formatPin, viewerUrl } from '../shared/ui.js';

function render(s: HostState): void {
  applyTheme(s.theme);
  $('pin').textContent = formatPin(s.pin);

  if (s.addresses.length === 0) {
    $('title').textContent = 'Waiting for a network';
    $('url').textContent = 'Connect a cable, hotspot or Wi-Fi';
    $('alt').textContent = '';
    return;
  }
  $('title').textContent = s.lockedUntil ? 'Too many wrong PINs, wait a minute' : 'PilotPane is ready';
  $('url').textContent = viewerUrl(s);
  $('alt').textContent = s.addresses
    .slice(1, 3)
    .map((a) => `or ${a.address}:${s.port} (${KIND_LABEL[a.kind] ?? a.iface})`)
    .join('\n');
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') api.act({ action: 'hide-pin-screen' });
});

api.onState(render);
api.getState().then(render);
