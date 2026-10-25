/** Low-level input the host can put on the screen. Viewer events map onto these in spec 011. */
export type MouseButton = 'left' | 'right' | 'middle';

export type InputCommand =
  /** Absolute position, 0..65535 across the primary screen. */
  | { kind: 'move'; x: number; y: number }
  | { kind: 'button'; button: MouseButton; down: boolean }
  /** Wheel notches: positive dy scrolls up, positive dx scrolls right. */
  | { kind: 'wheel'; dx: number; dy: number }
  /** Windows virtual-key code. */
  | { kind: 'key'; vk: number; down: boolean };

export const COORD_MAX = 65535;
export const WHEEL_MAX = 100;
export const VK_MAX = 254;

const BUTTON_CODE: Record<MouseButton, string> = { left: 'L', right: 'R', middle: 'M' };

function isInt(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
}

/**
 * Turns a command into one line of the helper's stdin protocol (see
 * apps/host/helper/PROTOCOL.md), or null if any value is out of range.
 */
export function formatCommand(cmd: InputCommand): string | null {
  switch (cmd.kind) {
    case 'move':
      return isInt(cmd.x, 0, COORD_MAX) && isInt(cmd.y, 0, COORD_MAX) ? `M ${cmd.x} ${cmd.y}` : null;
    case 'button': {
      const code = BUTTON_CODE[cmd.button];
      return code === undefined || typeof cmd.down !== 'boolean' ? null : `B ${code} ${cmd.down ? 1 : 0}`;
    }
    case 'wheel':
      return isInt(cmd.dx, -WHEEL_MAX, WHEEL_MAX) && isInt(cmd.dy, -WHEEL_MAX, WHEEL_MAX)
        ? `W ${cmd.dx} ${cmd.dy}`
        : null;
    case 'key':
      return isInt(cmd.vk, 1, VK_MAX) && typeof cmd.down === 'boolean' ? `K ${cmd.vk} ${cmd.down ? 1 : 0}` : null;
    default:
      return null;
  }
}
