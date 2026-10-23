/**
 * Turns the viewer's mouse into input messages. Click the picture to take
 * control: the pointer is locked inside it when the browser allows (Esc lets
 * go), otherwise the plain mouse position is used and Esc is caught by the page.
 * Plain HTTP is fine: pointer lock needs no secure context in Chrome 109.
 */
import type { Box, InputButton, InputMessage } from '/protocol/index.js';
import { COORD_MAX, toHostCoords, videoBox, WheelAccumulator } from '/protocol/index.js';

export type ControlState = 'viewing' | 'controlling';

export interface PointerHooks {
  /** Sends one message to the host; false if it could not be sent. */
  send(msg: InputMessage): boolean;
  /** Control started or ended. `locked` is false in the plain-mouse fallback. */
  onChange(state: ControlState, locked: boolean): void;
  /** The browser has no pointer lock, or refused it; control carries on without it. */
  onLockUnavailable(): void;
}

const BUTTONS: Record<number, InputButton | undefined> = { 0: 'left', 1: 'middle', 2: 'right' };

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const boxOf = (el: HTMLElement): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

export class PointerController {
  private enabled = false;
  private controlling = false;
  private locked = false;
  /** Position on the host screen as 0..1 of the picture, kept while the pointer is locked. */
  private fx = 0.5;
  private fy = 0.5;
  private pending: { x: number; y: number } | null = null;
  private frame = 0;
  private swallowUp = false;
  private readonly pressed = new Set<InputButton>();
  private readonly wheel = new WheelAccumulator();

  constructor(
    private readonly stage: HTMLElement,
    private readonly video: HTMLVideoElement,
    private readonly hooks: PointerHooks
  ) {
    stage.addEventListener('mousedown', (e) => this.onDown(e));
    stage.addEventListener('mouseup', (e) => this.onUp(e));
    stage.addEventListener('mousemove', (e) => this.onMove(e));
    stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    stage.addEventListener('contextmenu', (e) => {
      if (this.controlling) e.preventDefault();
    });
    document.addEventListener('pointerlockchange', () => this.onLockChange());
    document.addEventListener('pointerlockerror', () => this.hooks.onLockUnavailable());
    // Without pointer lock nothing else tells us Esc was pressed.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.controlling && !this.locked) this.release();
    });
    // Losing the window (alt-tab) must not leave a button held on the host.
    window.addEventListener('blur', () => this.release());
  }

  get isControlling(): boolean {
    return this.controlling;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** Whether the host accepts input. Turning it off ends any control. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.release();
  }

  /** Ends control: lifts held buttons and drops the lock. Safe to call at any time. */
  release(): void {
    window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pending = null;
    for (const button of this.pressed) this.hooks.send({ type: 'mouse-button', button, down: false });
    this.pressed.clear();
    this.wheel.reset();
    const wasLocked = this.locked;
    this.locked = false;
    if (wasLocked && document.pointerLockElement === this.stage) document.exitPointerLock();
    if (this.controlling) {
      this.controlling = false;
      this.hooks.onChange('viewing', false);
    }
  }

  /**
   * Frees the mouse so the toolbar and shortcut bar can be clicked, but keeps
   * control: keys still go to the host and the plain mouse position is used.
   */
  suspendLock(): void {
    if (!this.locked) return;
    this.locked = false;
    if (document.pointerLockElement === this.stage) document.exitPointerLock();
    this.hooks.onChange('controlling', false);
  }

  /** Locks the pointer again after `suspendLock`; the host pointer carries on from where it is. */
  resumeLock(): void {
    if (!this.controlling || this.locked) return;
    if (typeof this.stage.requestPointerLock === 'function') this.stage.requestPointerLock();
    else this.hooks.onLockUnavailable();
  }

  /** Frees the pointer if it is locked, locks it if control is on without the lock. */
  toggleLock(): void {
    if (this.locked) this.suspendLock();
    else this.resumeLock();
  }

  /** Clicks on the shortcut bar are for the viewer, not the host. */
  private isViewerUi(e: Event): boolean {
    return e.target instanceof Element && e.target.closest('[data-no-control]') !== null;
  }

  private begin(e: MouseEvent): void {
    this.controlling = true;
    const box = this.box();
    this.fx = box.width > 0 ? clamp01((e.clientX - box.left) / box.width) : 0.5;
    this.fy = box.height > 0 ? clamp01((e.clientY - box.top) / box.height) : 0.5;
    this.hooks.onChange('controlling', false);
    if (typeof this.stage.requestPointerLock === 'function') this.stage.requestPointerLock();
    else this.hooks.onLockUnavailable();
    this.queue(Math.round(this.fx * COORD_MAX), Math.round(this.fy * COORD_MAX));
  }

  private onLockChange(): void {
    if (document.pointerLockElement === this.stage) {
      this.locked = true;
      this.hooks.onChange('controlling', true);
    } else if (this.locked) {
      // Esc (or the browser) took the lock away.
      this.release();
    }
  }

  private box(): Box {
    return videoBox(boxOf(this.video), this.video.videoWidth, this.video.videoHeight);
  }

  private onDown(e: MouseEvent): void {
    if (!this.enabled) return;
    if (!this.controlling) {
      if (e.target !== this.video || e.button !== 0) return;
      e.preventDefault();
      this.swallowUp = true; // the click that takes control is not sent to the host
      this.begin(e);
      return;
    }
    if (this.isViewerUi(e)) return;
    const button = BUTTONS[e.button];
    if (!button) return;
    e.preventDefault();
    this.pressed.add(button);
    this.hooks.send({ type: 'mouse-button', button, down: true });
  }

  private onUp(e: MouseEvent): void {
    if (this.swallowUp && e.button === 0) {
      this.swallowUp = false;
      return;
    }
    if (!this.controlling) return;
    const button = BUTTONS[e.button];
    if (!button || !this.pressed.delete(button)) return;
    e.preventDefault();
    this.hooks.send({ type: 'mouse-button', button, down: false });
  }

  private onMove(e: MouseEvent): void {
    if (!this.controlling || this.isViewerUi(e)) return;
    if (this.locked) {
      const box = this.box();
      if (box.width <= 0 || box.height <= 0) return;
      this.fx = clamp01(this.fx + e.movementX / box.width);
      this.fy = clamp01(this.fy + e.movementY / box.height);
      this.queue(Math.round(this.fx * COORD_MAX), Math.round(this.fy * COORD_MAX));
    } else {
      const { x, y } = toHostCoords(e.clientX, e.clientY, this.box());
      this.fx = x / COORD_MAX; // so a later `resumeLock` continues from here
      this.fy = y / COORD_MAX;
      this.queue(x, y);
    }
  }

  private onWheel(e: WheelEvent): void {
    if (!this.controlling || this.isViewerUi(e)) return;
    e.preventDefault();
    const { dx, dy } = this.wheel.add(e.deltaX, e.deltaY, e.deltaMode, performance.now());
    if (dx || dy) this.hooks.send({ type: 'mouse-wheel', dx, dy });
  }

  /** At most one move per animation frame; the newest position wins. */
  private queue(x: number, y: number): void {
    this.pending = { x, y };
    if (this.frame) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0;
      const p = this.pending;
      this.pending = null;
      if (p && this.controlling) this.hooks.send({ type: 'mouse-move', x: p.x, y: p.y });
    });
  }
}
