import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AwakeGuard } from './awake-guard.js';
import type { Logger } from './log.js';
import type { KeepAwake } from './platform/keep-awake.js';

const quiet: Logger = { debug() {}, info() {}, warn() {}, error() {} };

function setup() {
  const calls: string[] = [];
  const keepAwake: KeepAwake = {
    start: () => calls.push('start'),
    stop: () => calls.push('stop')
  };
  return { calls, guard: new AwakeGuard(keepAwake, quiet) };
}

test('starts when a viewer pairs and stops when it is gone', () => {
  const { calls, guard } = setup();
  guard.viewerPaired();
  guard.viewerGone();
  assert.deepEqual(calls, ['start', 'stop']);
});

test('repeated calls start and stop once', () => {
  const { calls, guard } = setup();
  guard.viewerPaired();
  guard.viewerPaired();
  guard.viewerGone();
  guard.viewerGone();
  assert.deepEqual(calls, ['start', 'stop']);
});

test('gone before paired does nothing', () => {
  const { calls, guard } = setup();
  guard.viewerGone();
  assert.deepEqual(calls, []);
});

test('a viewer that comes back takes the block again', () => {
  const { calls, guard } = setup();
  guard.viewerPaired();
  guard.viewerGone();
  guard.viewerPaired();
  assert.deepEqual(calls, ['start', 'stop', 'start']);
});

test('dispose releases a held block', () => {
  const { calls, guard } = setup();
  guard.viewerPaired();
  guard.dispose();
  assert.deepEqual(calls, ['start', 'stop']);
});
