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

function notches(delta: number, mode: number): number {
  if (!delta || !Number.isFinite(delta)) return 0;
  const unit = mode === 0 ? PIXELS_PER_NOTCH : mode === 1 ? LINES_PER_NOTCH : 1;
  const n = Math.max(1, Math.round(Math.abs(delta) / unit));
  return Math.sign(delta) * Math.min(n, WHEEL_MAX);
}

/**
 * Browser wheel deltas (down and right are positive) to host notches
 * (positive dy scrolls up, positive dx scrolls right). Any movement is at least one notch.
 */
export function wheelToNotches(deltaX: number, deltaY: number, mode: number): { dx: number; dy: number } {
  return { dx: notches(deltaX, mode), dy: -notches(deltaY, mode) || 0 };
}
