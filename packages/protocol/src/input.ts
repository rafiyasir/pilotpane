/**
 * Input events the viewer sends to the host. They travel only over the
 * WebRTC data channel (encrypted), never over the WebSocket.
 */

export const INPUT_CHANNEL_LABEL = 'input';

/** Mouse positions are absolute across the host's primary screen. */
export const COORD_MAX = 65535;
export const WHEEL_MAX = 100;
export const MAX_INPUT_BYTES = 128;

export type InputButton = 'left' | 'right' | 'middle';

export type InputMessage =
  | { type: 'mouse-move'; x: number; y: number }
  | { type: 'mouse-button'; button: InputButton; down: boolean }
  /** Notches: positive dy scrolls up, positive dx scrolls right. */
  | { type: 'mouse-wheel'; dx: number; dy: number };

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Returns a typed input message, or null if the text is not a valid one. Never throws. */
export function parseInputMessage(raw: unknown): InputMessage | null {
  if (typeof raw !== 'string' || raw.length > MAX_INPUT_BYTES) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof m !== 'object' || m === null || Array.isArray(m)) return null;
  const o = m as Record<string, unknown>;
  switch (o.type) {
    case 'mouse-move':
      return isInt(o.x, 0, COORD_MAX) && isInt(o.y, 0, COORD_MAX) ? { type: 'mouse-move', x: o.x, y: o.y } : null;
    case 'mouse-button': {
      const b = o.button;
      return (b === 'left' || b === 'right' || b === 'middle') && typeof o.down === 'boolean'
        ? { type: 'mouse-button', button: b, down: o.down }
        : null;
    }
    case 'mouse-wheel':
      return isInt(o.dx, -WHEEL_MAX, WHEEL_MAX) && isInt(o.dy, -WHEEL_MAX, WHEEL_MAX)
        ? { type: 'mouse-wheel', dx: o.dx, dy: o.dy }
        : null;
    default:
      return null;
  }
}
