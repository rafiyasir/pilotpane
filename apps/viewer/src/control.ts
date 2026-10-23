/**
 * The mouse-control hint: toolbar badge, outline while controlling, the hint
 * card and the small pill. Copy and states follow the "Mouse hint" canvas.
 * It only shows things; PointerController does the controlling.
 */
import type { ControlState } from './pointer.js';

export interface ControlStore {
  hintSeen(): boolean;
  markHintSeen(): void;
}

type CardKind = 'first' | 'no-lock' | 'no-input';

const CARDS: Record<CardKind, { title: string; sub: string }> = {
  first: { title: 'Click the screen to control it.', sub: 'Press Esc to let go.' },
  'no-lock': {
    title: 'Your mouse still works.',
    sub: 'This browser cannot lock the pointer, so it can leave the window.'
  },
  'no-input': { title: 'Control is not available on this host.', sub: 'You can still watch the screen.' }
};

const FIRST_HINT_MS = 6000;
const PILL_MS = 4000;

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

export class ControlUi {
  private available: boolean | null = null;
  private state: ControlState = 'viewing';
  private cardTimer: number | undefined;
  private pillTimer: number | undefined;

  private readonly badge = byId('control-badge');
  private readonly outline = byId('control-outline');
  private readonly card = byId('control-card');
  private readonly pill = byId('control-pill');

  constructor(private readonly store: ControlStore) {
    byId('control-ok').addEventListener('click', () => {
      this.store.markHintSeen();
      this.hideCard();
    });
  }

  /** The host says whether it can put the mouse on its screen. */
  setAvailable(available: boolean): void {
    this.available = available;
    this.renderBadge();
  }

  /** The picture is on screen: show the first-time hint, or say control is off. */
  onStreaming(): void {
    if (this.available === false) this.showCard('no-input', false);
    else if (this.available === true && !this.store.hintSeen()) this.showCard('first', true);
  }

  onState(state: ControlState): void {
    const was = this.state;
    this.state = state;
    this.renderBadge();
    this.outline.hidden = state !== 'controlling';
    if (state === 'controlling') {
      this.store.markHintSeen();
      this.hideCard();
      this.showPill('Esc to let go', PILL_MS);
    } else if (was === 'controlling') {
      this.hideCard();
      this.showPill('Click to control again.', PILL_MS);
    }
  }

  /** Pointer lock is missing or was refused; control carries on with the plain mouse. */
  lockUnavailable(): void {
    this.hidePill();
    this.showCard('no-lock', false);
  }

  /** Back to a clean slate (stream ended or connection dropped). */
  reset(): void {
    this.state = 'viewing';
    this.available = null;
    this.outline.hidden = true;
    this.hideCard();
    this.hidePill();
    this.renderBadge();
  }

  private renderBadge(): void {
    this.badge.hidden = this.available === null;
    if (this.available === false) this.badge.textContent = 'Watching only';
    else this.badge.textContent = this.state === 'controlling' ? 'Controlling' : 'Viewing';
    this.badge.classList.toggle('control', this.available === true && this.state === 'controlling');
  }

  private showCard(kind: CardKind, autoHide: boolean): void {
    window.clearTimeout(this.cardTimer);
    const first = kind === 'first';
    byId('control-title').textContent = CARDS[kind].title;
    byId('control-sub').textContent = CARDS[kind].sub;
    byId('control-icon').style.display = first ? '' : 'none';
    byId('control-dot').hidden = first;
    this.card.hidden = false;
    if (autoHide) this.cardTimer = window.setTimeout(() => this.hideCard(), FIRST_HINT_MS);
  }

  private hideCard(): void {
    window.clearTimeout(this.cardTimer);
    this.card.hidden = true;
  }

  private showPill(text: string, ms: number): void {
    window.clearTimeout(this.pillTimer);
    this.pill.textContent = text;
    this.pill.classList.remove('gone');
    this.pill.hidden = false;
    this.pillTimer = window.setTimeout(() => this.pill.classList.add('gone'), ms);
  }

  private hidePill(): void {
    window.clearTimeout(this.pillTimer);
    this.pill.hidden = true;
  }
}
