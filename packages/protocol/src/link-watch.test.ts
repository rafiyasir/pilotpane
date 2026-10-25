import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LINK_DEAD_AFTER_MS, LinkWatch } from './link-watch.js';

test('a link whose byte count keeps moving is never dead', () => {
  const w = new LinkWatch();
  for (let t = 0; t < 60; t += 1) assert.equal(w.sample(t * 1000, 100 + t), false);
});

test('a link with no new bytes is dead after the timeout, not before', () => {
  const w = new LinkWatch();
  assert.equal(w.sample(0, 500), false);
  assert.equal(w.sample(LINK_DEAD_AFTER_MS - 1, 500), false);
  assert.equal(w.sample(LINK_DEAD_AFTER_MS, 500), true);
});

test('bytes arriving again clears the silence', () => {
  const w = new LinkWatch();
  w.sample(0, 500);
  assert.equal(w.sample(LINK_DEAD_AFTER_MS - 1000, 501), false);
  assert.equal(w.sample(LINK_DEAD_AFTER_MS + 1000, 501), false);
  assert.equal(w.sample(LINK_DEAD_AFTER_MS * 2, 501), true);
});

test('a slow trickle (keep-alives only) counts as alive', () => {
  const w = new LinkWatch();
  let bytes = 0;
  for (let t = 0; t <= 60; t += 1) {
    if (t % 5 === 0) bytes += 80;
    assert.equal(w.sample(t * 1000, bytes), false);
  }
});

test('reset starts a fresh baseline', () => {
  const w = new LinkWatch();
  w.sample(0, 10);
  assert.equal(w.sample(20_000, 10), true);
  w.reset();
  assert.equal(w.sample(21_000, 10), false);
});
