/**
 * Physical keys (KeyboardEvent.code) and the Windows virtual-key codes the host
 * types for them. The viewer sends the code, never a character, so the host's
 * own keyboard layout decides what appears.
 */

const TABLE: Record<string, number> = {
  Backspace: 0x08,
  Tab: 0x09,
  Enter: 0x0d,
  ShiftLeft: 0xa0,
  ShiftRight: 0xa1,
  ControlLeft: 0xa2,
  ControlRight: 0xa3,
  AltLeft: 0xa4,
  AltRight: 0xa5,
  Pause: 0x13,
  CapsLock: 0x14,
  Space: 0x20,
  PageUp: 0x21,
  PageDown: 0x22,
  End: 0x23,
  Home: 0x24,
  ArrowLeft: 0x25,
  ArrowUp: 0x26,
  ArrowRight: 0x27,
  ArrowDown: 0x28,
  PrintScreen: 0x2c,
  Insert: 0x2d,
  Delete: 0x2e,
  MetaLeft: 0x5b,
  MetaRight: 0x5c,
  ContextMenu: 0x5d,
  NumLock: 0x90,
  ScrollLock: 0x91,
  NumpadMultiply: 0x6a,
  NumpadAdd: 0x6b,
  NumpadSubtract: 0x6d,
  NumpadDecimal: 0x6e,
  NumpadDivide: 0x6f,
  NumpadEnter: 0x0d,
  Semicolon: 0xba,
  Equal: 0xbb,
  Comma: 0xbc,
  Minus: 0xbd,
  Period: 0xbe,
  Slash: 0xbf,
  Backquote: 0xc0,
  BracketLeft: 0xdb,
  Backslash: 0xdc,
  BracketRight: 0xdd,
  Quote: 0xde,
  IntlBackslash: 0xe2
};

for (let i = 0; i < 26; i++) TABLE[`Key${String.fromCharCode(65 + i)}`] = 0x41 + i;
for (let i = 0; i < 10; i++) {
  TABLE[`Digit${i}`] = 0x30 + i;
  TABLE[`Numpad${i}`] = 0x60 + i;
}
for (let i = 1; i <= 12; i++) TABLE[`F${i}`] = 0x6f + i;

/** The Windows virtual-key code for a KeyboardEvent.code, or null if we do not type that key. */
export function keyCodeToVk(code: unknown): number | null {
  if (typeof code !== 'string' || !Object.prototype.hasOwnProperty.call(TABLE, code)) return null;
  return TABLE[code] ?? null;
}
