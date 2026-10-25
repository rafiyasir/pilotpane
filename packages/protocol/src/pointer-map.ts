import { COORD_MAX, WHEEL_MAX } from './input.js';

/** A rectangle in CSS pixels. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Where the picture really is inside a video element that uses
 * `object-fit: contain` (black bars on the sides or top and bottom).
 * Falls back to the whole element until the video size is known.
 */
export function videoBox(element: Box, videoWidth: number, videoHeight: number): Box {
  if (!(videoWidth > 0) || !(videoHeight > 0) || !(element.width > 0) || !(element.height > 0)) return element;
  const scale = Math.min(element.width / videoWidth, element.height / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;
  return {
    left: element.left + (element.width - width) / 2,
    top: element.top + (element.height - height) / 2,
    width,
    height
  };
}

/** Pointer position in page pixels to 0..65535 across the host screen. Outside the picture clamps to its edge. */
export function toHostCoords(clientX: number, clientY: number, box: Box): { x: number; y: number } {
  const fx = box.width > 0 ? (clientX - box.left) / box.width : 0;
  const fy = box.height > 0 ? (clientY - box.top) / box.height : 0;
  return {
    x: Math.round(clamp(fx, 0, 1) * COORD_MAX),
    y: Math.round(clamp(fy, 0, 1) * COORD_MAX)
  };
}

/** Wheel event deltaMode values: pixels, lines, pages. */
const PIXELS_PER_NOTCH = 100;
const LINES_PER_NOTCH = 3;

/** A pause this long (ms) forgets any leftover fraction of a notch. */
const WHEEL_IDLE_MS = 250;

function notchUnits(delta: number, mode: number): number {
  if (!delta || !Number.isFinite(delta)) return 0;
  const unit = mode === 0 ? PIXELS_PER_NOTCH : mode === 1 ? LINES_PER_NOTCH : 1;
  return delta / unit;
}

/**
 * Turns browser wheel deltas (down and right are positive) into whole host notches
 * (positive dy scrolls up, positive dx scrolls right). A touchpad sends many tiny
 * deltas for one swipe, so the fractions are added up and a notch is sent only when
 * a whole one has built up. A mouse wheel click is one full notch at once.
 */
export class WheelAccumulator {
  private x = 0;
  private y = 0;
  private last = 0;

  add(deltaX: number, deltaY: number, mode: number, now: number): { dx: number; dy: number } {
    if (now - this.last > WHEEL_IDLE_MS) this.reset();
    this.last = now;
    this.x = this.take(this.x, notchUnits(deltaX, mode));
    this.y = this.take(this.y, notchUnits(deltaY, mode));
    const dx = Math.trunc(this.x);
    const dy = Math.trunc(this.y);
    this.x -= dx;
    this.y -= dy;
    const limit = (n: number) => Math.sign(n) * Math.min(Math.abs(n), WHEEL_MAX);
    return { dx: limit(dx) || 0, dy: -limit(dy) || 0 };
  }

  /** Forget leftovers, for example when control ends. */
  reset(): void {
    this.x = 0;
    this.y = 0;
  }

  /** Add to the running total; turning around drops what was left going the other way. */
  private take(total: number, add: number): number {
    return Math.sign(total) === -Math.sign(add) ? add : total + add;
  }
}
