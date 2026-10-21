/**
 * PilotPane viewer: pair with a PIN, receive the host's screen, and recover
 * from network drops. Built for Chrome 109 (ES2020, no newer browser APIs).
 */
import type { HostMessage, ThemeName } from '/protocol/index.js';
import { PIN_LENGTH, PROTOCOL_VERSION, THEMES, isQualityPreset, isThemeName, pinProof } from '/protocol/index.js';
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
const RETRY_DELAYS_S = [1, 2, 4, 8, 10];

// ---------- state ----------

type Phase = 'connecting' | 'pin' | 'pairing' | 'starting' | 'streaming' | 'reconnecting' | 'stopped';

let phase: Phase = 'connecting';
let nonce: string | null = null;
let hostName = 'the host';
let userStopped = false;
let retryCount = 0;
let retryTimer: number | undefined;
let lockTimer: number | undefined;
let statsTimer: number | undefined;
let statsTick = 0;

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
  },
  onFailed: () => {
    socket.dispose();
    onDrop();
  }
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
      $<HTMLSelectElement>('quality').value = msg.preset;
      return;
    case 'bye':
      handleBye(msg.reason);
      return;
  }
}

function handleBye(reason: 'host-stopped' | 'kicked' | 'new-pin' | 'capture-failed'): void {
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

function onDrop(): void {
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
  const text = `Trying again, attempt ${retryCount}. The last picture stays on screen.`;
  if (overStage) {
    $('reconnecting').hidden = false;
    $('reconnecting-text').textContent = text;
  } else {
    showCard({
      label: 'Reconnecting',
      tone: 'accent',
      title: "Can't reach the host",
      text: `Check that PilotPane is running and both laptops share a network. Attempt ${retryCount}.`,
      spinner: true,
      primary: { text: 'Stop trying', run: stopTrying }
    });
  }
  retryTimer = window.setTimeout(() => socket.connect(), delay);
}

function stop(): void {
  userStopped = true;
  window.clearTimeout(retryTimer);
  window.clearInterval(lockTimer);
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
  statsTimer = window.setInterval(async () => {
    const s = await receiver.stats().catch(() => null);
    if (!s) return;
    statsTick += 1;
    $('s-rtt').textContent = s.rttMs === null ? '-' : `${Math.round(s.rttMs)} ms`;
    $('s-fps').textContent = String(Math.round(s.fps));
    $('s-kbps').textContent = `${(s.kbps / 1000).toFixed(1)} Mbps`;
    $('s-size').textContent = s.width ? `${s.width}×${s.height}` : '-';
    $('s-codec').textContent = s.codec;
    $('s-loss').textContent = `${s.lossPct.toFixed(1)}%`;
    if (statsTick % 2 === 0) socket.send({ type: 'stats', stats: s });
  }, 1000);
}

function stopStats(): void {
  window.clearInterval(statsTimer);
}

// ---------- toolbar, fullscreen, themes ----------

function setupToolbar(): void {
  const stage = $('stage');
  const toolbar = $('toolbar');
  const hint = $('hint');
  let hideTimer: number | undefined;
  let idleTimer: number | undefined;

  const showBar = () => {
    toolbar.classList.add('visible');
    window.clearTimeout(hideTimer);
  };
  const hideBarSoon = () => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!toolbar.matches(':hover') && !toolbar.contains(document.activeElement)) toolbar.classList.remove('visible');
    }, 1200);
  };

  stage.addEventListener('mousemove', (e) => {
    stage.classList.remove('idle');
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => stage.classList.add('idle'), 3000);
    if (e.clientY < 90) showBar();
    else hideBarSoon();
  });
  toolbar.addEventListener('focusin', showBar);
  window.setTimeout(() => hint.classList.add('gone'), 6000);

  $<HTMLSelectElement>('quality').addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    if (isQualityPreset(value)) socket.send({ type: 'set-quality', preset: value });
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
    box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === theme)));
  };
  for (const theme of THEMES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.theme = theme;
    b.textContent = THEME_NAMES[theme];
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
