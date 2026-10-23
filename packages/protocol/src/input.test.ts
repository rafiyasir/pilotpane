import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHostMessage } from './parse.js';
import { parseInputMessage } from './input.js';

const j = (v: unknown): string => JSON.stringify(v);

test('parses valid mouse messages', () => {
  assert.deepEqual(parseInputMessage(j({ type: 'mouse-move', x: 0, y: 65535 })), {
    type: 'mouse-move',
    x: 0,
    y: 65535
  });
  assert.deepEqual(parseInputMessage(j({ type: 'mouse-button', button: 'right', down: true })), {
    type: 'mouse-button',
    button: 'right',
    down: true
  });
  assert.deepEqual(parseInputMessage(j({ type: 'mouse-wheel', dx: -100, dy: 3 })), {
    type: 'mouse-wheel',
    dx: -100,
    dy: 3
  });
});

test('drops extra fields from the result', () => {
  assert.deepEqual(parseInputMessage(j({ type: 'mouse-move', x: 1, y: 2, evil: 'x' })), {
    type: 'mouse-move',
    x: 1,
    y: 2
  });
});

test('rejects bad input without throwing', () => {
  const bad: unknown[] = [
    'not json',
    '[]',
    'null',
    42,
    undefined,
    j({ type: 'key', vk: 65 }),
    j({ type: 'mouse-move', x: 1 }),
    j({ type: 'mouse-move', x: 1.5, y: 2 }),
    j({ type: 'mouse-move', x: -1, y: 2 }),
    j({ type: 'mouse-move', x: 65536, y: 2 }),
    j({ type: 'mouse-move', x: '1', y: 2 }),
    j({ type: 'mouse-button', button: 'back', down: true }),
    j({ type: 'mouse-button', button: 'left' }),
    j({ type: 'mouse-button', button: 'left', down: 1 }),
    j({ type: 'mouse-wheel', dx: 101, dy: 0 }),
    j({ type: 'mouse-wheel', dx: 0, dy: 0.5 }),
    j({ type: 'mouse-move', x: 1, y: 2, pad: 'x'.repeat(200) })
  ];
  for (const raw of bad) assert.equal(parseInputMessage(raw), null, String(raw));
});

test('parses input-state from the host', () => {
  assert.deepEqual(parseHostMessage(j({ type: 'input-state', available: true })), {
    type: 'input-state',
    available: true
  });
  assert.equal(parseHostMessage(j({ type: 'input-state', available: 'yes' })), null);
  assert.equal(parseHostMessage(j({ type: 'input-state' })), null);
});
