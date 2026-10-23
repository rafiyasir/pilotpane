import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KeyTracker } from './key-tracker.js';
import { parseInputMessage } from './input.js';
import { keyCodeToVk } from './keys.js';

const j = (v: unknown): string => JSON.stringify(v);

test('maps common keys to virtual-key codes', () => {
  assert.equal(keyCodeToVk('KeyA'), 0x41);
  assert.equal(keyCodeToVk('KeyZ'), 0x5a);
  assert.equal(keyCodeToVk('Digit0'), 0x30);
  assert.equal(keyCodeToVk('Numpad5'), 0x65);
  assert.equal(keyCodeToVk('F1'), 0x70);
  assert.equal(keyCodeToVk('F12'), 0x7b);
  assert.equal(keyCodeToVk('Enter'), 0x0d);
  assert.equal(keyCodeToVk('ArrowLeft'), 0x25);
  assert.equal(keyCodeToVk('ShiftLeft'), 0xa0);
  assert.equal(keyCodeToVk('MetaLeft'), 0x5b);
});

test('rejects unknown codes and odd values', () => {
  for (const c of ['', 'Nope', 'keya', 'toString', '__proto__', 'constructor', 5, null, undefined]) {
    assert.equal(keyCodeToVk(c), null, String(c));
  }
});

test('mapped codes stay within 1..254', () => {
  const codes = ['Backspace', 'IntlBackslash', 'NumpadDivide', 'ContextMenu', 'F12', 'PrintScreen'];
  for (const c of codes) {
    const vk = keyCodeToVk(c);
    assert.ok(vk !== null && vk >= 1 && vk <= 254, c);
  }
});

test('parses a valid key message and drops extra fields', () => {
  assert.deepEqual(parseInputMessage(j({ type: 'key', code: 'KeyA', down: true, evil: 1 })), {
    type: 'key',
    code: 'KeyA',
    down: true
  });
});

test('rejects bad key messages', () => {
  assert.equal(parseInputMessage(j({ type: 'key', code: 'Nope', down: true })), null);
  assert.equal(parseInputMessage(j({ type: 'key', down: true })), null);
  assert.equal(parseInputMessage(j({ type: 'key', code: 'KeyA' })), null);
  assert.equal(parseInputMessage(j({ type: 'key', code: 'KeyA', down: 1 })), null);
  assert.equal(parseInputMessage(j({ type: 'key', code: 7, down: true })), null);
  assert.equal(parseInputMessage(j({ type: 'key', code: 'KeyA'.repeat(60), down: true })), null);
});

test('tracker forwards a press, then its repeats, and ignores stray ones', () => {
  const t = new KeyTracker();
  assert.equal(t.press('KeyA', true, true), null); // repeat of a key we never saw go down
  assert.deepEqual(t.press('KeyA', true, false), { type: 'key', code: 'KeyA', down: true });
  assert.deepEqual(t.press('KeyA', true, true), { type: 'key', code: 'KeyA', down: true });
  assert.equal(t.press('KeyA', true, false), null); // a second plain down is a glitch
  assert.deepEqual(t.press('KeyA', false, false), { type: 'key', code: 'KeyA', down: false });
});

test('tracker never forwards Esc or unknown keys', () => {
  const t = new KeyTracker();
  assert.equal(t.press('Escape', true, false), null);
  assert.equal(t.press('Escape', false, false), null);
  assert.equal(t.press('LaunchMail', true, false), null);
});

test('tracker ignores a key up it never sent down', () => {
  assert.equal(new KeyTracker().press('KeyA', false, false), null);
});

test('tracker releaseAll lifts held keys once', () => {
  const t = new KeyTracker();
  t.press('ShiftLeft', true, false);
  t.press('KeyB', true, false);
  t.press('KeyB', false, false);
  assert.deepEqual(t.releaseAll(), [{ type: 'key', code: 'ShiftLeft', down: false }]);
  assert.deepEqual(t.releaseAll(), []);
});
