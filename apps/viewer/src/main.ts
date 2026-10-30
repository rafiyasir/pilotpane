/**
 * PilotPane viewer: pair with a PIN, receive the host's screen, and recover
 * from network drops. Built for Chrome 109 (ES2020, no newer browser APIs).
 */
import type { HostMessage, QualityPreset, ThemeName } from '/protocol/index.js';
import {
  PIN_LENGTH,
  autoStart,
  autoStep,
  PROTOCOL_VERSION,
  THEMES,
  isQualityPreset,
  isThemeName,
  LinkWatch,
  pinProof
} from '/protocol/index.js';
import { ControlUi } from './control.js';
import { KeyboardController } from './keyboard.js';
import { PointerController } from './pointer.js';
import { ShortcutBar } from './shortcut-bar.js';
import { Receiver } from './receiver.js';
import { HostSocket } from './socket.js';

// ---------- small helpers ----------

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

/** Browser storage can be missing or throw (private mode, blocked data). */
const store = {
  get(area: 'local' | 'session', key: string): string | null {
    try {
      return (area === 'local' ? localStorage : sessionStorage).getItem(key);
    } catch {
      return null;
    }
  },
  set(area: 'local' | 'session', key: string, value: string | null): void {
    try {
      const s = area === 'local' ? localStorage : sessionStorage;
      if (value === null) s.removeItem(key);
      else s.setItem(key, value);
    } catch {
      /* ignore */
    }
  }
};

const TOKEN_KEY = 'pilotpane.token';
const THEME_KEY = 'pilotpane.theme';
const STATS_KEY = 'pilotpane.stats';
const PINNED_KEY = 'pilotpane.toolbarPinned';
const MOUSE_HINT_KEY = 'pilotpane.mouseHintSeen';
const LOW_HINT_KEY = 'pilotpane.lowHintSeen';
const SHORTCUT_HINT_KEY = 'pilotpane.shortcutHintSeen';
const SHORTCUT_BAR_KEY = 'pilotpane.shortcutBar';
const QUALITY_KEY = 'pilotpane.quality';
const TAB_KEY = 'pilotpane.toolbarTab';
const RETRY_DELAYS_S = [1, 2, 4, 8, 10];

// ---------- state ----------

type Phase = 'connecting' | 'pin' | 'pairing' | 'starting' | 'streaming' | 'reconnecting' | 'stopped';

let phase: Phase = 'connecting';
let nonce: string | null = null;
let hostName = 'the host';
let userStopped = false;
/** The host said `bye paused`: keep retrying and say why. */
let hostPaused = false;
let retryCount = 0;
let retryTimer: number | undefined;
let lockTimer: number | undefined;
let statsTimer: number | undefined;
let statsTick = 0;
/** 'auto' or a fixed preset. Remembered per browser. */
let qualityMode: QualityPreset | 'auto' = 'auto';
let currentPreset: QualityPreset = '720p';
let auto = autoStart(currentPreset, 0);
const linkWatch = new LinkWatch();

const video = $<HTMLVideoElement>('video');

const socket = new HostSocket({
  onOpen: () => {
    retryCount = 0;
  },
  onMessage: (msg) => handleMessage(msg),
  onClose: () => {
    if (!userStopped) onDrop();
  }
});

const receiver = new Receiver(video, {
  sendAnswer: (sdp) => socket.send({ type: 'answer', sdp }),
  sendIce: (candidate) => socket.send({ type: 'ice', candidate }),
  onConnected: () => {
    phase = 'streaming';
    showStage();
    startStats();
    applyStoredQuality();
    controlUi.onStreaming();
  },
  onFailed: () => {
    socket.dispose();
    onDrop();
  }
});

const controlUi = new ControlUi({
  hintSeen: () => store.get('local', MOUSE_HINT_KEY) === '1',
  markHintSeen: () => store.set('local', MOUSE_HINT_KEY, '1'),
  lowHintSeen: () => store.get('local', LOW_HINT_KEY) === '1',
  markLowHintSeen: () => store.set('local', LOW_HINT_KEY, '1'),
  shortcutHintSeen: () => store.get('local', SHORTCUT_HINT_KEY) === '1',
  markShortcutHintSeen: () => store.set('local', SHORTCUT_HINT_KEY, '1')
});

const shortcutBar = new ShortcutBar({
  send: (msg) => receiver.sendInput(msg),
  load: () => store.get('local', SHORTCUT_BAR_KEY),
  save: (json) => store.set('local', SHORTCUT_BAR_KEY, json)
});

const pointer = new PointerController($('stage'), video, {
  send: (msg) => receiver.sendInput(msg),
  onChange: (state) => {
    if (state === 'viewing') keyboard.release();
    controlUi.onState(state);
    shortcutBar.setControlling(state === 'controlling');
  },
  onLockUnavailable: () => controlUi.lockUnavailable()
});
const keyboard = new KeyboardController({
  send: (msg) => receiver.sendInput(msg),
  isControlling: () => pointer.isControlling
});

// ---------- screens ----------

interface CardOptions {
  label: string;
  tone?: 'accent' | 'err';
  title: string;
  text?: string;
  spinner?: boolean;
  primary?: { text: string; run(): void };
  secondary?: { text: string; run(): void };
}

function showShell(): void {
  $('stage').hidden = true;
  $('shell').hidden = false;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
}

function showCard(o: CardOptions): void {
  showShell();
  $('pin-form').hidden = true;
  $('status-card').hidden = false;
  const label = $('card-label');
  label.textContent = o.label;
  label.className = `card-label${o.tone ? ` ${o.tone}` : ''}`;
  $('card-title').textContent = o.title;
  $('card-text').textContent = o.text ?? '';
  $('card-spinner').hidden = !o.spinner;
  for (const [id, opt] of [
    ['card-primary', o.primary],
    ['card-secondary', o.secondary]
  ] as const) {
    const b = $<HTMLButtonElement>(id);
    b.hidden = !opt;
    if (opt) {
      b.textContent = opt.text;
      b.onclick = opt.run;
    }
  }
}

function showStage(): void {
  $('shell').hidden = true;
  $('stage').hidden = false;
  $('reconnecting').hidden = true;
  $('host-name').textContent = hostName;
}

// ---------- PIN entry ----------

const digitInputs: HTMLInputElement[] = [];

function buildDigits(): void {
  const box = $('digits');
  for (let i = 0; i < PIN_LENGTH; i++) {
    const input = document.createElement('input');
    input.inputMode = 'numeric';
    input.maxLength = 1;
    input.setAttribute('aria-label', `PIN digit ${i + 1}`);
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(-1);
      if (input.value && i < PIN_LENGTH - 1) digitInputs[i + 1]!.focus();
      if (pinValue().length === PIN_LENGTH) submitPin();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && i > 0) digitInputs[i - 1]!.focus();
      if (e.key === 'ArrowLeft' && i > 0) digitInputs[i - 1]!.focus();
      if (e.key === 'ArrowRight' && i < PIN_LENGTH - 1) digitInputs[i + 1]!.focus();
    });
    input.addEventListener('paste', (e) => {
      const text = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
      if (!text) return;
      e.preventDefault();
      text
        .slice(0, PIN_LENGTH)
        .split('')
        .forEach((d, j) => {
          const target = digitInputs[j];
          if (target) target.value = d;
        });
      if (pinValue().length === PIN_LENGTH) submitPin();
    });
    digitInputs.push(input);
    box.appendChild(input);
  }
  $('pin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitPin();
  });
}

function pinValue(): string {
  return digitInputs.map((i) => i.value).join('');
}

function setPinEnabled(enabled: boolean): void {
  digitInputs.forEach((i) => (i.disabled = !enabled));
  $<HTMLButtonElement>('pin-submit').disabled = !enabled;
}

function showPin(error?: string): void {
  phase = 'pin';
  showShell();
  $('status-card').hidden = true;
  $('pin-form').hidden = false;
  $('pin-title').textContent = `Connect to ${hostName}`;
  const err = $('pin-error');
  err.hidden = !error;
  err.textContent = error ?? '';
  $('digits').classList.toggle('wrong', Boolean(error));
  digitInputs.forEach((i) => (i.value = ''));
  $<HTMLButtonElement>('pin-submit').textContent = 'Connect';
  setPinEnabled(true);
  digitInputs[0]?.focus();
}

function submitPin(): void {
  const pin = pinValue();
  if (phase !== 'pin' || pin.length !== PIN_LENGTH || !nonce) return;
  phase = 'pairing';
  setPinEnabled(false);
  $<HTMLButtonElement>('pin-submit').textContent = 'Checking...';
  socket.send({ type: 'pair', proof: pinProof(nonce, pin) });
}

function showLocked(seconds: number): void {
  showPin();
  setPinEnabled(false);
  let left = seconds;
  const err = $('pin-error');
  err.hidden = false;
  const tick = () => {
    err.textContent = `Too many wrong tries. Try again in ${left} s.`;
    if (left <= 0) {
      window.clearInterval(lockTimer);
      showPin();
    }
    left -= 1;
  };
  window.clearInterval(lockTimer);
  tick();
  lockTimer = window.setInterval(tick, 1000);
}

// ---------- protocol ----------

function handleMessage(msg: HostMessage): void {
  switch (msg.type) {
    case 'hello': {
      nonce = msg.nonce;
      hostName = msg.hostName;
      $('foot-version').textContent = `pilotpane v${msg.appVersion}`;
      if (msg.protocol !== PROTOCOL_VERSION) {
        stop();
        showCard({
          label: 'Version mismatch',
          tone: 'err',
          title: 'This page and the host are different versions',
          text: 'Reload the page. If it keeps happening, update PilotPane on the host.',
          primary: { text: 'Reload', run: () => location.reload() }
        });
        return;
      }
      const token = store.get('session', TOKEN_KEY);
      if (token) {
        if (phase !== 'reconnecting') phase = 'pairing';
        socket.send({ type: 'resume', token });
      } else {
        showPin();
      }
      return;
    }
    case 'paired':
      hostPaused = false;
      store.set('session', TOKEN_KEY, msg.token);
      if (phase === 'reconnecting') return; // keep the last frame on screen
      phase = 'starting';
      showCard({
        label: 'Connecting',
        title: 'Starting the stream',
        text: 'PIN accepted. Setting up the video link.',
        spinner: true
      });
      return;
    case 'pair-failed':
      if (msg.reason === 'bad-token') {
        store.set('session', TOKEN_KEY, null);
        showPin();
      } else if (msg.reason === 'locked') {
        showLocked(msg.retryAfterSec);
      } else {
        const tries = msg.attemptsLeft === 1 ? '1 try left' : `${msg.attemptsLeft} tries left`;
        showPin(`That PIN didn't match. ${tries}.`);
      }
      return;
    case 'busy':
      stop();
      showCard({
        label: 'Host busy',
        title: 'Someone else is connected',
        text: 'PilotPane allows one viewer at a time. Disconnect the other viewer first.',
        primary: { text: 'Check again', run: retryNow }
      });
      return;
    case 'offer':
      receiver.handleOffer(msg.sdp).catch((err: unknown) => {
        console.error('[pilotpane] offer failed', err);
        stop();
        showCard({
          label: 'Video error',
          tone: 'err',
          title: "This browser couldn't start the video",
          text: String(err instanceof Error ? err.message : err),
          primary: { text: 'Try again', run: retryNow }
        });
      });
      return;
    case 'ice':
      receiver.addIce(msg.candidate).catch((err: unknown) => console.warn('[pilotpane] ice', err));
      return;
    case 'quality':
      currentPreset = msg.preset;
      $('s-quality').textContent = msg.preset;
      if (qualityMode !== 'auto') {
        $<HTMLSelectElement>('quality').value = msg.preset;
        if (msg.preset === 'low') controlUi.onLowSelected();
      }
      return;
    case 'input-state':
      controlUi.setAvailable(msg.available);
      shortcutBar.setAvailable(msg.available);
      pointer.setEnabled(msg.available);
      return;
    case 'bye':
      handleBye(msg.reason);
      return;
  }
}

function handleBye(reason: 'host-stopped' | 'kicked' | 'new-pin' | 'capture-failed' | 'paused'): void {
  if (reason === 'paused') {
    // The socket closes right after this; its close event runs onDrop and the retry loop.
    hostPaused = true;
    return;
  }
  hostPaused = false;
  stop();
  if (reason === 'new-pin') {
    store.set('session', TOKEN_KEY, null);
    userStopped = false;
    socket.connect(); // get a fresh hello and nonce
    showCard({ label: 'New PIN', title: 'The host made a new PIN', spinner: true });
    return;
  }
  const texts = {
    'host-stopped': [
      'The host stopped sharing',
      `PilotPane was closed or paused on ${hostName}. When it's running again, reconnect.`
    ],
    kicked: ['The host disconnected you', 'You can reconnect when the host is ready.'],
    'capture-failed': [
      "The host couldn't capture its screen",
      'Try again. If it keeps happening, restart PilotPane on the host.'
    ]
  } as const;
  const [title, text] = texts[reason];
  showCard({
    label: 'Disconnected',
    title,
    text,
    primary: { text: 'Reconnect', run: retryNow },
    secondary: { text: 'Enter a new PIN', run: newPin }
  });
}

// ---------- connection lifecycle ----------

function endControl(): void {
  pointer.release();
  pointer.setEnabled(false);
  controlUi.reset();
  shortcutBar.reset();
}

function onDrop(): void {
  endControl();
  receiver.close();
  stopStats();
  const wasWatching = phase === 'streaming' || phase === 'reconnecting';
  phase = wasWatching ? 'reconnecting' : 'connecting';
  scheduleRetry(wasWatching);
}

function scheduleRetry(overStage: boolean): void {
  window.clearTimeout(retryTimer);
  const delay = (RETRY_DELAYS_S[Math.min(retryCount, RETRY_DELAYS_S.length - 1)] ?? 10) * 1000;
  retryCount += 1;
  const text = hostPaused
    ? `Sharing is paused on ${hostName}. Waiting for it to resume.`
    : `Trying again, attempt ${retryCount}. The last picture stays on screen.`;
  if (overStage) {
    $('reconnecting').hidden = false;
    $('reconnecting-text').textContent = text;
  } else {
    showCard({
      label: 'Reconnecting',
      tone: 'accent',
      title: hostPaused ? 'Sharing is paused' : "Can't reach the host",
      text: hostPaused
        ? `Sharing is paused on ${hostName}. Waiting for it to resume.`
        : `Check that PilotPane is running and both laptops share a network. Attempt ${retryCount}.`,
      spinner: true,
      primary: { text: 'Stop trying', run: stopTrying }
    });
  }
  retryTimer = window.setTimeout(() => {
    hostPaused = false; // a paused host says so again; a host that quit does not
    socket.connect();
  }, delay);
}

/** The browser is back (network up, tab shown): skip the wait before the next try. */
function retrySoon(): void {
  if (userStopped || retryCount === 0) return;
  if (phase !== 'reconnecting' && phase !== 'connecting') return;
  window.clearTimeout(retryTimer);
  retryCount = 0;
  hostPaused = false;
  socket.connect();
}

window.addEventListener('online', retrySoon);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) retrySoon();
});

function stop(): void {
  userStopped = true;
  hostPaused = false;
  window.clearTimeout(retryTimer);
  window.clearInterval(lockTimer);
  endControl();
  receiver.close();
  stopStats();
  socket.dispose();
  phase = 'stopped';
}

function stopTrying(): void {
  stop();
  showCard({
    label: 'Disconnected',
    title: 'Stopped trying to reconnect',
    text: `Reconnect when PilotPane is running on ${hostName}.`,
    primary: { text: 'Reconnect', run: retryNow },
    secondary: { text: 'Enter a new PIN', run: newPin }
  });
}

function retryNow(): void {
  stop();
  userStopped = false;
  retryCount = 0;
  phase = 'connecting';
  showCard({ label: 'Connecting', title: 'Connecting to the host', spinner: true });
  socket.connect();
}

function newPin(): void {
  store.set('session', TOKEN_KEY, null);
  retryNow();
}

// ---------- stats overlay ----------

function startStats(): void {
  stopStats();
  statsTick = 0;
  linkWatch.reset();
  statsTimer = window.setInterval(async () => {
    const bytes = await receiver.transportBytes().catch(() => null);
    if (bytes !== null && phase === 'streaming' && linkWatch.sample(Date.now(), bytes)) {
      console.warn('[pilotpane] the link went quiet, reconnecting');
      socket.dispose();
      onDrop();
      return;
    }
    const s = await receiver.stats().catch(() => null);
    if (!s || phase !== 'streaming') return;
    statsTick += 1;
    $('s-rtt').textContent = s.rttMs === null ? '-' : `${Math.round(s.rttMs)} ms`;
    $('s-fps').textContent = String(Math.round(s.fps));
    $('s-kbps').textContent = `${(s.kbps / 1000).toFixed(1)} Mbps`;
    $('s-size').textContent = s.width ? `${s.width}×${s.height}` : '-';
    $('s-codec').textContent = s.codec;
    $('s-loss').textContent = `${s.lossPct.toFixed(1)}%`;
    if (statsTick % 2 === 0) socket.send({ type: 'stats', stats: s });
    if (qualityMode === 'auto') {
      auto = autoStep(auto, s, Date.now());
      if (auto.preset !== currentPreset) socket.send({ type: 'set-quality', preset: auto.preset });
    }
  }, 1000);
}

function setQualityMode(mode: QualityPreset | 'auto'): void {
  qualityMode = mode;
  store.set('local', QUALITY_KEY, mode);
  $<HTMLSelectElement>('quality').value = mode;
}

/** After the picture starts, go back to the last choice this browser made (Auto if none). */
function applyStoredQuality(): void {
  const stored = store.get('local', QUALITY_KEY);
  if (isQualityPreset(stored)) {
    setQualityMode(stored);
    if (stored !== currentPreset) socket.send({ type: 'set-quality', preset: stored });
  } else {
    setQualityMode('auto');
    auto = autoStart(currentPreset, Date.now());
  }
}

function stopStats(): void {
  window.clearInterval(statsTimer);
}

// ---------- toolbar, fullscreen, themes ----------

function setupToolbar(): void {
  const stage = $('stage');
  const toolbar = $('toolbar');
  const tab = $('toolbar-tab');
  const pinBtn = $('btn-pin');
  const hint = $('hint');
  let idleTimer: number | undefined;
  let open = false;
  let pinned = store.get('local', PINNED_KEY) === '1';

  // The toolbar shows when it is open (tab or shortcut) or pinned as a strip.
  const renderToolbar = () => {
    stage.classList.toggle('pinned', pinned);
    tab.hidden = pinned;
    toolbar.hidden = !(open || pinned);
    tab.setAttribute('aria-expanded', String(open));
    tab.setAttribute('aria-label', open ? 'Hide toolbar' : 'Show toolbar');
    pinBtn.setAttribute('aria-pressed', String(pinned));
    placeToolbar();
  };
  const setToolbarOpen = (on: boolean) => {
    if (pinned) return;
    open = on;
    renderToolbar();
  };
  const toggleBar = () => setToolbarOpen(!open);

  // The tab can be dragged anywhere on the stream. Its position is kept as a
  // fraction of the stage so it survives resizes and fullscreen.
  const TAB_W = 64;
  const TAB_H = 18;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let tabFx = 0.5;
  let tabFy = 0;
  try {
    const saved: unknown = JSON.parse(store.get('local', TAB_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      const { x, y } = saved as { x?: unknown; y?: unknown };
      if (typeof x === 'number' && typeof y === 'number' && x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        tabFx = x;
        tabFy = y;
      }
    }
  } catch {
    /* keep the default */
  }

  // Put the open toolbar next to the tab, kept inside the stage.
  const placeToolbar = () => {
    if (pinned || toolbar.hidden) {
      toolbar.style.removeProperty('left');
      toolbar.style.removeProperty('top');
      return;
    }
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const tabX = clamp(tabFx * w, TAB_W / 2, w - TAB_W / 2);
    const tabY = clamp(tabFy * h, 0, h - TAB_H);
    const bw = toolbar.offsetWidth;
    const bh = toolbar.offsetHeight;
    const cx = clamp(tabX, bw / 2 + 12, Math.max(bw / 2 + 12, w - bw / 2 - 12));
    const below = tabY + TAB_H;
    toolbar.style.left = `${cx}px`;
    toolbar.style.top = `${below + bh > h ? Math.max(0, tabY - bh) : below}px`;
  };
  const placeTab = () => {
    tab.style.setProperty('--tab-fx', String(tabFx));
    tab.style.setProperty('--tab-fy', String(tabFy));
    tab.classList.toggle('floating', tabFy > 0.002);
    placeToolbar();
  };

  let drag: { dx: number; dy: number; startX: number; startY: number; moved: boolean } | null = null;
  let suppressClick = false;
  tab.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const r = tab.getBoundingClientRect();
    drag = {
      dx: e.clientX - (r.left + r.width / 2),
      dy: e.clientY - r.top,
      startX: e.clientX,
      startY: e.clientY,
      moved: false
    };
    tab.setPointerCapture(e.pointerId);
  });
  tab.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) < 5) return;
      drag.moved = true;
      tab.classList.add('dragging');
    }
    const r = stage.getBoundingClientRect();
    tabFx = clamp((e.clientX - drag.dx - r.left) / r.width, TAB_W / 2 / r.width, 1 - TAB_W / 2 / r.width);
    tabFy = clamp((e.clientY - drag.dy - r.top) / r.height, 0, 1 - TAB_H / r.height);
    placeTab();
  });
  const endDrag = () => {
    if (!drag) return;
    if (drag.moved) {
      suppressClick = true; // the click that follows a drag must not toggle the toolbar
      window.setTimeout(() => (suppressClick = false), 0);
      store.set('local', TAB_KEY, JSON.stringify({ x: tabFx, y: tabFy }));
    }
    tab.classList.remove('dragging');
    drag = null;
  };
  tab.addEventListener('pointerup', endDrag);
  tab.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', placeToolbar);
  document.addEventListener('fullscreenchange', placeToolbar);

  renderToolbar();
  placeTab();

  stage.addEventListener('mousemove', () => {
    stage.classList.remove('idle');
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => stage.classList.add('idle'), 3000);
  });
  tab.addEventListener('click', () => {
    if (!suppressClick) toggleBar();
  });
  $('video').addEventListener('click', () => {
    if (open && !pinned) {
      open = false;
      renderToolbar();
    }
  });
  // Ctrl+Alt+Shift pressed together. Not Esc: Chrome uses it to leave fullscreen.
  document.addEventListener('keydown', (e) => {
    if (e.repeat || $('stage').hidden || !(e.ctrlKey && e.altKey && e.shiftKey)) return;
    if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift') return;
    e.preventDefault();
    if (pointer.isControlling) {
      // A locked pointer cannot click the toolbar or the shortcut bar: free it and show the
      // toolbar, keeping control. The chord again locks the pointer and hides the toolbar.
      const freeing = pointer.isLocked;
      pointer.toggleLock();
      setToolbarOpen(freeing);
    } else {
      toggleBar();
    }
  });
  pinBtn.addEventListener('click', () => {
    pinned = !pinned;
    open = !pinned; // unpinning keeps the toolbar open so the click has a visible result
    store.set('local', PINNED_KEY, pinned ? '1' : '0');
    renderToolbar();
  });
  window.setTimeout(() => hint.classList.add('gone'), 6000);

  $<HTMLSelectElement>('quality').addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    if (value === 'auto') {
      setQualityMode('auto');
      auto = autoStart(currentPreset, Date.now());
    } else if (isQualityPreset(value)) {
      setQualityMode(value);
      socket.send({ type: 'set-quality', preset: value });
    }
  });

  const statsBtn = $('btn-stats');
  const setStatsVisible = (on: boolean) => {
    statsBtn.setAttribute('aria-pressed', String(on));
    $('stats').hidden = !on;
    store.set('local', STATS_KEY, on ? '1' : '0');
  };
  setStatsVisible(store.get('local', STATS_KEY) === '1');
  statsBtn.addEventListener('click', () => setStatsVisible(statsBtn.getAttribute('aria-pressed') !== 'true'));

  const fsBtn = $('btn-fullscreen');
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else stage.requestFullscreen().catch(() => undefined);
  });
  document.addEventListener('fullscreenchange', () => {
    fsBtn.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  });

  $('btn-disconnect').addEventListener('click', () => {
    socket.send({ type: 'leave' });
    stop();
    showCard({
      label: 'Disconnected',
      title: 'You disconnected',
      text: `${hostName} is still sharing. Reconnect any time.`,
      primary: { text: 'Reconnect', run: retryNow },
      secondary: { text: 'Enter a new PIN', run: newPin }
    });
  });

  $('btn-stop-retry').addEventListener('click', stopTrying);

  const badge = $('mode-badge');
  if (window.isSecureContext) {
    badge.textContent = 'Secure mode';
    badge.classList.add('secure');
  }
}

const THEME_NAMES: Record<ThemeName, string> = {
  cockpit: 'Cockpit',
  daylight: 'Daylight',
  midnight: 'Midnight',
  contrast: 'Contrast'
};

function setupThemes(): void {
  const box = $('themes');
  const apply = (theme: ThemeName) => {
    document.documentElement.dataset.theme = theme;
    store.set('local', THEME_KEY, theme);
    box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeId === theme)));
  };
  for (const theme of THEMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.themeId = theme;
    b.setAttribute('aria-label', `${THEME_NAMES[theme]} theme`);
    b.title = `${THEME_NAMES[theme]} theme`;
    b.addEventListener('click', () => apply(theme));
    box.appendChild(b);
  }
  const saved = store.get('local', THEME_KEY);
  apply(isThemeName(saved) ? saved : 'cockpit');
}

// ---------- start ----------

function start(): void {
  setupThemes();
  setupToolbar();
  buildDigits();

  if (typeof RTCPeerConnection === 'undefined' || typeof WebSocket === 'undefined') {
    showCard({
      label: 'Browser not supported',
      tone: 'err',
      title: "This browser can't play the stream",
      text: 'It is missing WebRTC video. Chrome 109 or newer, recent Edge and recent Firefox all work.'
    });
    return;
  }
  showCard({ label: 'Connecting', title: 'Connecting to the host', spinner: true });
  socket.connect();
}

start();
