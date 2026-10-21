import type { HostState, ThemeName } from '/protocol/index.js';
import { THEMES } from '/protocol/index.js';
import { $, KIND_LABEL, api, applyTheme, formatDuration, formatPin, viewerUrl } from '../shared/ui.js';

const THEME_NAMES: Record<ThemeName, string> = {
  cockpit: 'Cockpit',
  daylight: 'Daylight',
  midnight: 'Midnight',
  contrast: 'Contrast'
};

let state: HostState | null = null;

function buildThemeChips(): void {
  const box = $('themes');
  for (const theme of THEMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.themeId = theme;
    b.textContent = THEME_NAMES[theme];
    b.addEventListener('click', () => api.act({ action: 'set-theme', theme }));
    box.appendChild(b);
  }
}

function show(view: 'ready' | 'connected' | 'problem'): void {
  $('view-ready').hidden = view !== 'ready';
  $('view-connected').hidden = view !== 'connected';
  $('view-problem').hidden = view !== 'problem';
}

function setList(el: HTMLElement, items: string[]): void {
  el.replaceChildren(
    ...items.map((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    })
  );
}

function renderProblem(s: HostState): void {
  const title = $('problem-title');
  const text = $('problem-text');
  const steps = $('problem-steps');
  const action = $('problem-action') as HTMLButtonElement;
  action.hidden = false;

  if (s.status === 'paused') {
    title.textContent = 'Sharing is paused';
    text.textContent = 'Nobody can connect until you resume.';
    setList(steps, []);
    action.textContent = 'Resume sharing';
    action.onclick = () => api.act({ action: 'resume' });
  } else if (s.status === 'no-network') {
    title.textContent = 'No local network found';
    text.textContent = 'PilotPane needs a network shared with the other laptop. Pick one:';
    setList(steps, [
      'Plug an Ethernet cable between the two laptops',
      'Turn on Mobile hotspot on this laptop',
      'Join both laptops to the same router',
      'Pair over a Bluetooth network (slow)'
    ]);
    action.hidden = true;
  } else if (s.status === 'port-busy') {
    title.textContent = `Port ${s.port} is busy`;
    text.textContent = 'Another app is using this port, or PilotPane is already running. Check the tray first.';
    setList(steps, []);
    action.textContent = `Use port ${s.port + 1}`;
    action.onclick = () => api.act({ action: 'use-next-port' });
  } else {
    title.textContent = 'Something went wrong';
    text.textContent = s.message ?? 'Try a new PIN, or restart PilotPane.';
    setList(steps, []);
    action.textContent = 'New PIN';
    action.onclick = () => api.act({ action: 'new-pin' });
  }
}

function render(s: HostState): void {
  state = s;
  applyTheme(s.theme);
  document.querySelectorAll<HTMLButtonElement>('#themes .chip').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.themeId === s.theme));
  });
  $('version').textContent = `v${s.appVersion}`;

  if (s.viewer && (s.status === 'connecting' || s.status === 'streaming')) {
    show('connected');
    $('conn-title').textContent = s.status === 'streaming' ? 'Viewer connected' : 'Viewer connecting';
    $('conn-dot').className = s.status === 'streaming' ? 'dot ok' : 'dot';
    $('viewer-browser').textContent = s.viewer.browser;
    $('viewer-address').textContent = s.viewer.address;
    const st = s.stats;
    $('st-res').textContent = st ? `${st.height}p` : '-';
    $('st-fps').textContent = st ? `${Math.round(st.fps)} fps` : '-';
    $('st-kbps').textContent = st ? `${(st.kbps / 1000).toFixed(1)} Mbps` : '-';
    $('st-rtt').textContent = st?.rttMs != null ? `${Math.round(st.rttMs)} ms` : '-';
    return;
  }

  if (s.status === 'ready' || s.status === 'starting' || s.status === 'connecting') {
    show('ready');
    $('pin').textContent = formatPin(s.pin);
    $('url').textContent = `http://${viewerUrl(s)}`;
    setList(
      $('addresses'),
      s.addresses.map((a) => `${KIND_LABEL[a.kind] ?? a.iface}  ${a.address}`)
    );
    const lock = $('lock');
    if (s.lockedUntil) {
      lock.hidden = false;
      lock.textContent = 'Too many wrong PINs. Pairing is paused for a minute.';
    } else {
      lock.hidden = true;
    }
    return;
  }

  show('problem');
  renderProblem(s);
}

buildThemeChips();
$('btn-new-pin').addEventListener('click', () => api.act({ action: 'new-pin' }));
$('btn-new-pin-2').addEventListener('click', () => api.act({ action: 'new-pin' }));
$('btn-show-pin').addEventListener('click', () => api.act({ action: 'show-pin-screen' }));
$('btn-pause').addEventListener('click', () => api.act({ action: 'pause' }));
$('btn-disconnect').addEventListener('click', () => api.act({ action: 'disconnect-viewer' }));

api.onState(render);
api.getState().then(render);

setInterval(() => {
  if (state?.viewer) $('since').textContent = formatDuration(Date.now() - state.viewer.since);
}, 1000);
