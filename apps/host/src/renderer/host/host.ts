import type { HostState, ThemeName, UpdateFailure, UpdateState } from '/protocol/index.js';
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
    b.className = 'swatch';
    b.dataset.themeId = theme;
    b.setAttribute('aria-label', `${THEME_NAMES[theme]} theme`);
    b.title = `${THEME_NAMES[theme]} theme`;
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

const UPDATE_PROBLEM: Record<UpdateFailure, string> = {
  offline: 'PilotPane could not reach the update page. Check the internet connection and try again.',
  'bad-manifest': 'The update information could not be read, so nothing was installed.',
  'bad-signature': 'The update did not pass the safety check, so it was not installed.',
  'bad-download': 'The downloaded file did not pass the safety check, so it was not installed.',
  'download-failed': 'The download did not finish, so nothing was installed.',
  'install-failed': 'The installer could not be started. Try the installer from the download page instead.'
};

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0);
}

function renderUpdate(u: UpdateState, current: string): void {
  const card = $('update-card');
  card.hidden = u.phase === 'idle';
  $('btn-check-update').toggleAttribute('disabled', ['checking', 'downloading', 'verifying'].includes(u.phase));
  if (u.phase === 'idle') return;

  const dot = $('update-dot');
  const title = $('update-title');
  const version = $('update-version');
  const text = $('update-text');
  const primary = $('update-primary') as HTMLButtonElement;
  const secondary = $('update-secondary') as HTMLButtonElement;
  const bar = $('update-bar');
  const progress = $('update-progress');

  dot.className = 'dot';
  version.textContent = '';
  text.hidden = false;
  text.textContent = '';
  setList($('update-notes'), []);
  bar.hidden = true;
  progress.hidden = true;
  primary.hidden = true;
  secondary.hidden = true;

  const setBar = (fraction: number): void => {
    const percent = Math.round(fraction * 100);
    bar.hidden = false;
    bar.setAttribute('aria-valuenow', String(percent));
    $('update-bar-fill').style.width = `${percent}%`;
  };

  switch (u.phase) {
    case 'checking':
      title.textContent = 'Checking for updates';
      text.hidden = true;
      return;
    case 'up-to-date':
      dot.className = 'dot ok';
      title.textContent = 'You are up to date';
      version.textContent = `v${current}`;
      text.hidden = true;
      return;
    case 'available':
      title.textContent = 'Update available';
      version.textContent = `v${u.version}`;
      text.textContent = `You have ${current}. What is new:`;
      setList($('update-notes'), u.notes);
      primary.hidden = false;
      primary.textContent = 'Download';
      primary.onclick = () => api.act({ action: 'download-update' });
      secondary.hidden = false;
      secondary.textContent = 'Later';
      secondary.onclick = () => api.act({ action: 'dismiss-update' });
      return;
    case 'downloading':
      title.textContent = `Downloading ${u.version}`;
      text.hidden = true;
      setBar(u.totalBytes ? u.receivedBytes / u.totalBytes : 0);
      progress.hidden = false;
      progress.textContent = `${megabytes(u.receivedBytes)} of ${megabytes(u.totalBytes)} MB`;
      return;
    case 'verifying':
      title.textContent = 'Checking the update';
      text.hidden = true;
      setBar(1);
      return;
    case 'ready':
      title.textContent = 'Update ready';
      version.textContent = `v${u.version}`;
      text.textContent = 'PilotPane will close, install the update and start again. Any viewer is disconnected.';
      primary.hidden = false;
      primary.textContent = 'Restart to install';
      primary.onclick = () => api.act({ action: 'install-update' });
      return;
    case 'failed':
      dot.className = 'dot err';
      title.textContent = 'Could not update';
      text.textContent = `${UPDATE_PROBLEM[u.reason]} You are still on ${current}.`;
      primary.hidden = false;
      primary.textContent = 'Try again';
      primary.onclick = () => api.act({ action: 'check-for-updates' });
      secondary.hidden = false;
      secondary.textContent = 'Keep this version';
      secondary.onclick = () => api.act({ action: 'dismiss-update' });
      return;
  }
}

function render(s: HostState): void {
  state = s;
  applyTheme(s.theme);
  document.querySelectorAll<HTMLButtonElement>('#themes .swatch').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.themeId === s.theme));
  });
  $('version').textContent = `v${s.appVersion}`;
  renderUpdate(s.update, s.appVersion);

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
$('btn-check-update').addEventListener('click', () => api.act({ action: 'check-for-updates' }));
$('btn-disconnect').addEventListener('click', () => api.act({ action: 'disconnect-viewer' }));

api.onState(render);
api.getState().then(render);

setInterval(() => {
  if (state?.viewer) $('since').textContent = formatDuration(Date.now() - state.viewer.since);
}, 1000);
