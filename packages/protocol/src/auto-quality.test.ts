import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autoStart, autoStep, AUTO_MIN_GAP_MS, AUTO_UP_AFTER_MS, type AutoState } from './auto-quality.js';
import type { StreamStats } from './messages.js';

const stats = (over: Partial<StreamStats>): StreamStats => ({
  fps: 30,
  kbps: 3000,
  rttMs: 20,
  width: 1920,
  height: 1080,
  codec: 'H264',
  lossPct: 0,
  ...over
});
const BAD = stats({ lossPct: 8 });
const GOOD = stats({});

/** Feed the same sample once a second for `seconds`, starting after `from`. */
function run(state: AutoState, sample: StreamStats, from: number, seconds: number): AutoState {
  let s = state;
  for (let t = 1; t <= seconds; t += 1) s = autoStep(s, sample, from + t * 1000);
  return s;
}

test('steps down after sustained loss', () => {
  const s0 = autoStart('1080p', 0);
  assert.equal(run(s0, BAD, 20_000, 3).preset, '1080p');
  assert.equal(run(s0, BAD, 20_000, 8).preset, '720p');
});

test('steps down on a high round trip', () => {
  assert.equal(run(autoStart('720p', 0), stats({ rttMs: 400 }), 20_000, 8).preset, 'low');
});

test('a still desktop (low fps, no loss) does not step down', () => {
  assert.equal(run(autoStart('1080p', 0), stats({ fps: 2, kbps: 20 }), 20_000, 60).preset, '1080p');
});

test('a short bad spell is forgotten', () => {
  let s = run(autoStart('1080p', 0), BAD, 20_000, 4);
  s = run(s, GOOD, 24_000, 1);
  s = run(s, BAD, 25_000, 4);
  assert.equal(s.preset, '1080p');
});

test('steps up only after the quiet period', () => {
  const s0 = autoStart('low', 0);
  assert.equal(run(s0, GOOD, 0, AUTO_UP_AFTER_MS / 1000).preset, 'low');
  assert.equal(run(s0, GOOD, 0, AUTO_UP_AFTER_MS / 1000 + 1).preset, '720p');
});

test('holds the minimum gap between changes', () => {
  // Bad since t=1s, so it could step at 7s, but the first 15s are protected.
  assert.equal(run(autoStart('1080p', 0), BAD, 0, 10).preset, '1080p');
  const first = run(autoStart('1080p', 0), BAD, 0, AUTO_MIN_GAP_MS / 1000 + 6);
  assert.equal(first.preset, '720p');
  // A new bad run after a change waits for both 6s of trouble and 15s since the change.
  const at = first.changedAt;
  const soon = run(first, BAD, at, 10);
  assert.equal(soon.preset, '720p');
  assert.equal(run(first, BAD, at, 16).preset, 'low');
});

test('never leaves low..1080p', () => {
  assert.equal(run(autoStart('low', 0), BAD, 20_000, 60).preset, 'low');
  assert.equal(run(autoStart('1080p', 0), GOOD, 0, 120).preset, '1080p');
});

test('an unknown round trip counts as quiet', () => {
  assert.equal(run(autoStart('low', 0), stats({ rttMs: null }), 0, 31).preset, '720p');
});
