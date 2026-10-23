/**
 * The shortcut bar: four buttons for combinations the browser keeps for itself
 * (Alt+Tab, Win, Alt+F4, Ctrl+W). It is shown only while controlling, and the
 * toolbar's "Shortcuts" chip opens and closes it. The bar can be dragged by its
 * grip, resized by its corner and made see-through with its slider; the choice
 * is kept per browser. Copy and states follow the "Shortcut bar" canvas.
 */
import type { InputMessage } from '/protocol/index.js';
import { SHORTCUTS, comboMessages } from '/protocol/index.js';

export interface ShortcutBarHooks {
  /** Sends one message to the host; false if it could not be sent. */
  send(msg: InputMessage): boolean;
  /** The saved layout as JSON text, or null. */
  load(): string | null;
  save(json: string): void;
}

interface Layout {
  /** Position as 0..1 of the free room in the stream; null = bottom centre. */
  fx: number | null;
  fy: number | null;
  scale: number;
  /** 0.4..1 */
  opacity: number;
}

const MIN_SCALE = 0.75;
const MAX_SCALE = 2;
const MIN_OPACITY = 0.4;
/** Space kept under the default position for the "Esc to let go" pill. */
const BOTTOM_GAP = 88;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function readLayout(json: string | null): Layout {
  const layout: Layout = { fx: null, fy: null, scale: 1, opacity: 1 };
  try {
    const v: unknown = JSON.parse(json ?? 'null');
    if (!v || typeof v !== 'object') return layout;
    const { fx, fy, scale, opacity } = v as Record<string, unknown>;
    if (typeof fx === 'number' && typeof fy === 'number' && fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) {
      layout.fx = fx;
      layout.fy = fy;
    }
    if (typeof scale === 'number') layout.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
    if (typeof opacity === 'number') layout.opacity = clamp(opacity, MIN_OPACITY, 1);
  } catch {
    /* keep the defaults */
  }
  return layout;
}

export class ShortcutBar {
  private available = false;
  private controlling = false;
  private open = false;
  private layout: Layout;

  private readonly stage = byId('stage');
  private readonly bar = byId('shortcut-bar');
  private readonly chip = byId('btn-shortcuts');
  private readonly slider = document.createElement('input');

  constructor(private readonly hooks: ShortcutBarHooks) {
    this.layout = readLayout(hooks.load());

    const grip = document.createElement('div');
    grip.className = 'bar-grip';
    grip.title = 'Drag to move';
    grip.setAttribute('aria-hidden', 'true');
    grip.textContent = '⋮⋮';
    this.bar.appendChild(grip);
    this.onDrag(grip, (start, dx, dy) => this.moveTo(start.left + dx, start.top + dy));

    for (const shortcut of SHORTCUTS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.textContent = shortcut.label;
      // Keep focus where it is, so using the bar never ends control.
      button.addEventListener('mousedown', (e) => e.preventDefault());
      button.addEventListener('click', () => {
        if (!this.controlling) return;
        // Send everything even if one message fails, so no key is left down.
        for (const msg of comboMessages(shortcut.codes)) this.hooks.send(msg);
      });
      this.bar.appendChild(button);
    }

    this.slider.type = 'range';
    this.slider.className = 'bar-opacity';
    this.slider.min = String(MIN_OPACITY * 100);
    this.slider.max = '100';
    this.slider.step = '5';
    this.slider.title = 'Opacity';
    this.slider.setAttribute('aria-label', 'Opacity');
    this.slider.value = String(Math.round(this.layout.opacity * 100));
    this.slider.addEventListener('input', () => {
      this.layout.opacity = clamp(Number(this.slider.value) / 100, MIN_OPACITY, 1);
      this.bar.style.opacity = String(this.layout.opacity);
      this.persist();
    });
    this.bar.appendChild(this.slider);

    const handle = document.createElement('div');
    handle.className = 'bar-resize';
    handle.title = 'Drag to resize';
    handle.setAttribute('aria-hidden', 'true');
    this.bar.appendChild(handle);
    let startScale = 1;
    this.onDrag(
      handle,
      (start, dx) => {
        // Grow from the top left corner: the bar keeps its place while it scales.
        this.layout.scale = clamp(startScale + dx / Math.max(1, this.bar.offsetWidth), MIN_SCALE, MAX_SCALE);
        this.moveTo(start.left, start.top);
      },
      () => (startScale = this.layout.scale)
    );

    this.chip.addEventListener('click', () => {
      if (!this.canUse()) return;
      this.open = !this.open;
      this.render();
    });
    window.addEventListener('resize', () => this.place());
    document.addEventListener('fullscreenchange', () => this.place());
    this.render();
  }

  /** The host says whether it can take input. */
  setAvailable(available: boolean): void {
    this.available = available;
    this.render();
  }

  /** Control started or ended. */
  setControlling(controlling: boolean): void {
    this.controlling = controlling;
    this.render();
  }

  /** Back to a clean slate (stream ended or connection dropped). */
  reset(): void {
    this.available = false;
    this.controlling = false;
    this.open = false;
    this.render();
  }

  private canUse(): boolean {
    return this.available && this.controlling;
  }

  private render(): void {
    const usable = this.canUse();
    this.chip.toggleAttribute('disabled', !usable);
    this.chip.setAttribute('aria-pressed', String(usable && this.open));
    this.bar.hidden = !(usable && this.open);
    this.bar.style.opacity = String(this.layout.opacity);
    this.place();
  }

  /** Puts the bar where the layout says, kept inside the stream. */
  private place(): void {
    if (this.bar.hidden) return;
    const { width: w, height: h } = this.size();
    const roomX = Math.max(0, this.stage.clientWidth - w);
    const roomY = Math.max(0, this.stage.clientHeight - h);
    const left = this.layout.fx === null ? roomX / 2 : this.layout.fx * roomX;
    const top = this.layout.fy === null ? Math.max(0, roomY - BOTTOM_GAP) : this.layout.fy * roomY;
    this.bar.style.transform = `scale(${this.layout.scale})`;
    this.bar.style.left = `${left}px`;
    this.bar.style.top = `${top}px`;
  }

  /** On-screen size of the bar, scale included. */
  private size(): { width: number; height: number } {
    return { width: this.bar.offsetWidth * this.layout.scale, height: this.bar.offsetHeight * this.layout.scale };
  }

  /** Moves the bar to a pixel position (clamped), remembers it as a fraction, and saves. */
  private moveTo(left: number, top: number): void {
    this.bar.style.transform = `scale(${this.layout.scale})`;
    const { width: w, height: h } = this.size();
    const roomX = Math.max(0, this.stage.clientWidth - w);
    const roomY = Math.max(0, this.stage.clientHeight - h);
    this.layout.fx = roomX > 0 ? clamp(left / roomX, 0, 1) : 0;
    this.layout.fy = roomY > 0 ? clamp(top / roomY, 0, 1) : 0;
    this.place();
    this.persist();
  }

  private persist(): void {
    this.hooks.save(JSON.stringify(this.layout));
  }

  /**
   * Makes `el` a drag handle. `onMove` gets where the bar was when the drag
   * began (stage pixels) and how far the pointer has moved.
   */
  private onDrag(
    el: HTMLElement,
    onMove: (start: { left: number; top: number }, dx: number, dy: number) => void,
    onStart?: () => void
  ): void {
    let drag: { x: number; y: number; left: number; top: number } | null = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const bar = this.bar.getBoundingClientRect();
      const stage = this.stage.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, left: bar.left - stage.left, top: bar.top - stage.top };
      onStart?.();
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (drag) onMove(drag, e.clientX - drag.x, e.clientY - drag.y);
    });
    const end = () => (drag = null);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
