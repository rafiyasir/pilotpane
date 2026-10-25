import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseInputMessage } from './input.js';
import { keyCodeToVk } from './keys.js';
import { comboMessages, SHORTCUTS } from './shortcuts.js';

test('Alt+Tab goes down in order and up in reverse', () => {
  assert.deepEqual(comboMessages(['AltLeft', 'Tab']), [
    { type: 'key', code: 'AltLeft', down: true },
    { type: 'key', code: 'Tab', down: true },
    { type: 'key', code: 'Tab', down: false },
    { type: 'key', code: 'AltLeft', down: false }
  ]);
});

test('a single key is pressed and released', () => {
  assert.deepEqual(comboMessages(['MetaLeft']), [
    { type: 'key', code: 'MetaLeft', down: true },
    { type: 'key', code: 'MetaLeft', down: false }
  ]);
});

test('the bar offers the four designed shortcuts', () => {
  assert.deepEqual(
    SHORTCUTS.map((s) => s.label),
    ['Alt+Tab', 'Win', 'Alt+F4', 'Ctrl+W']
  );
});

test('every shortcut is made of known keys that the parser accepts', () => {
  for (const s of SHORTCUTS) {
    for (const code of s.codes) assert.notEqual(keyCodeToVk(code), null, `${s.label}: ${code}`);
    const msgs = comboMessages(s.codes);
    assert.equal(msgs.length, s.codes.length * 2);
    for (const m of msgs) assert.deepEqual(parseInputMessage(JSON.stringify(m)), m, s.label);
    // Nothing is left held.
    const held = new Set<string>();
    for (const m of msgs) {
      if (m.type !== 'key') continue;
      if (m.down) held.add(m.code);
      else held.delete(m.code);
    }
    assert.equal(held.size, 0, s.label);
  }
});
