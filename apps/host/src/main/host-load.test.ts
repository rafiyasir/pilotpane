import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HostLoadGovernor, LOAD_MIN_GAP_MS, LOAD_UP_AFTER_MS } from './host-load.js';

function setup() {
  let t = 0;
  const gov = new HostLoadGovernor(() => t);
  /** Feed `reason` every 5 s for `ms`; returns the levels reported. */
  const feed = (reason: string, ms: number): number[] => {
    const out: number[] = [];
    for (const end = t + ms; t < end;) {
      t += 5_000;
      const l = gov.sample(reason);
      if (l !== null) out.push(l);
    }
    return out;
  };
  return { gov, feed, advance: (ms: number) => (t += ms) };
}

test('steps down after a sustained cpu limit', () => {
  const { gov, feed, advance } = setup();
  advance(LOAD_MIN_GAP_MS);
  assert.deepEqual(feed('cpu', 10_000), [1]);
  assert.equal(gov.level, 1);
});

test('holds on a short cpu spike', () => {
  const { gov, feed, advance } = setup();
  advance(LOAD_MIN_GAP_MS);
  feed('cpu', 5_000);
  assert.deepEqual(feed('none', 10_000), []);
  assert.equal(gov.level, 0);
});

test('other reasons do not step down', () => {
  const { gov, feed, advance } = setup();
  advance(LOAD_MIN_GAP_MS);
  assert.deepEqual(feed('bandwidth', 60_000), []);
  assert.equal(gov.level, 0);
});

test('changes at most once per gap and stops at the last level', () => {
  const { gov, feed, advance } = setup();
  advance(LOAD_MIN_GAP_MS);
  assert.deepEqual(feed('cpu', 120_000), [1, 2]);
  assert.equal(gov.level, 2);
});

test('steps back up after a quiet spell', () => {
  const { gov, feed, advance } = setup();
  advance(LOAD_MIN_GAP_MS);
  feed('cpu', 10_000);
  assert.equal(gov.level, 1);
  assert.deepEqual(feed('none', LOAD_UP_AFTER_MS + 5_000), [0]);
});

test('reset returns to full quality', () => {
  const { gov, feed, advance } = setup();
  advance(LOAD_MIN_GAP_MS);
  feed('cpu', 10_000);
  gov.reset();
  assert.equal(gov.level, 0);
});
