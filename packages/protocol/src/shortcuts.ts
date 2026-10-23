import type { InputMessage } from './input.js';

/**
 * Key combinations a browser on plain HTTP keeps for itself, so the viewer
 * offers them as buttons instead (the shortcut bar). Pure: no DOM.
 */
export interface Shortcut {
  /** Text on the button. */
  label: string;
  /** Physical key codes, modifiers first. */
  codes: readonly string[];
}

export const SHORTCUTS: readonly Shortcut[] = [
  { label: 'Alt+Tab', codes: ['AltLeft', 'Tab'] },
  { label: 'Win', codes: ['MetaLeft'] },
  { label: 'Alt+F4', codes: ['AltLeft', 'F4'] },
  { label: 'Ctrl+W', codes: ['ControlLeft', 'KeyW'] }
];

/** Keys down in order, then up in reverse, so the modifier is lifted last. */
export function comboMessages(codes: readonly string[]): InputMessage[] {
  const down: InputMessage[] = codes.map((code) => ({ type: 'key', code, down: true }));
  const up: InputMessage[] = [...codes].reverse().map((code) => ({ type: 'key', code, down: false }));
  return [...down, ...up];
}
