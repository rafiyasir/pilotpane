import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCommand, type InputCommand } from './input-command.js';

test('formats each command type', () => {
  assert.equal(formatCommand({ kind: 'move', x: 32768, y: 1 }), 'M 32768 1');
  assert.equal(formatCommand({ kind: 'button', button: 'left', down: true }), 'B L 1');
  assert.equal(formatCommand({ kind: 'button', button: 'right', down: false }), 'B R 0');
  assert.equal(formatCommand({ kind: 'button', button: 'middle', down: true }), 'B M 1');
  assert.equal(formatCommand({ kind: 'wheel', dx: 0, dy: -1 }), 'W 0 -1');
  assert.equal(formatCommand({ kind: 'key', vk: 65, down: true }), 'K 65 1');
});

test('accepts the boundary values', () => {
  assert.equal(formatCommand({ kind: 'move', x: 0, y: 65535 }), 'M 0 65535');
  assert.equal(formatCommand({ kind: 'wheel', dx: -100, dy: 100 }), 'W -100 100');
  assert.equal(formatCommand({ kind: 'key', vk: 254, down: false }), 'K 254 0');
});

test('rejects out-of-range and malformed values', () => {
  const bad: unknown[] = [
    { kind: 'move', x: -1, y: 0 },
    { kind: 'move', x: 65536, y: 0 },
    { kind: 'move', x: Number.NaN, y: 0 },
    { kind: 'move', x: 1.5, y: 0 },
    { kind: 'move', x: '1', y: 0 },
    { kind: 'button', button: 'back', down: true },
    { kind: 'button', button: 'left', down: 1 },
    { kind: 'wheel', dx: 0, dy: 101 },
    { kind: 'wheel', dx: Number.POSITIVE_INFINITY, dy: 0 },
    { kind: 'key', vk: 0, down: true },
    { kind: 'key', vk: 255, down: true },
    { kind: 'key', vk: 65, down: 'yes' },
    { kind: 'nope' }
  ];
  for (const cmd of bad) assert.equal(formatCommand(cmd as InputCommand), null, JSON.stringify(cmd));
});
