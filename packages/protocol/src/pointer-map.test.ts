import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toHostCoords, videoBox, wheelToNotches } from './pointer-map.js';

const screen = { left: 0, top: 0, width: 1000, height: 500 };

test('videoBox fills the element when the aspect ratios match', () => {
  assert.deepEqual(videoBox(screen, 2000, 1000), screen);
});

test('videoBox adds bars at the sides for a narrower picture', () => {
  const box = videoBox(screen, 1000, 1000); // square picture in a wide element
  assert.deepEqual(box, { left: 250, top: 0, width: 500, height: 500 });
});

test('videoBox adds bars at top and bottom for a wider picture', () => {
  const box = videoBox({ left: 10, top: 20, width: 1000, height: 1000 }, 1920, 1080);
  const near = (a: number, b: number): void => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
  near(box.width, 1000);
  near(box.height, 562.5);
  near(box.left, 10);
  near(box.top, 20 + (1000 - 562.5) / 2);
});

test('videoBox falls back to the element before the video size is known', () => {
  assert.deepEqual(videoBox(screen, 0, 0), screen);
});

test('toHostCoords maps corners and centre', () => {
  assert.deepEqual(toHostCoords(0, 0, screen), { x: 0, y: 0 });
  assert.deepEqual(toHostCoords(1000, 500, screen), { x: 65535, y: 65535 });
  assert.deepEqual(toHostCoords(500, 250, screen), { x: 32768, y: 32768 });
});

test('toHostCoords respects the letterbox offset', () => {
  const box = { left: 250, top: 0, width: 500, height: 500 };
  assert.deepEqual(toHostCoords(250, 0, box), { x: 0, y: 0 });
  assert.deepEqual(toHostCoords(750, 500, box), { x: 65535, y: 65535 });
});

test('toHostCoords clamps outside the picture and handles an empty box', () => {
  const box = { left: 250, top: 0, width: 500, height: 500 };
  assert.deepEqual(toHostCoords(10, -40, box), { x: 0, y: 0 });
  assert.deepEqual(toHostCoords(2000, 900, box), { x: 65535, y: 65535 });
  assert.deepEqual(toHostCoords(5, 5, { left: 0, top: 0, width: 0, height: 0 }), { x: 0, y: 0 });
});

test('wheelToNotches flips vertical direction and gives at least one notch', () => {
  assert.deepEqual(wheelToNotches(0, 100, 0), { dx: 0, dy: -1 }); // wheel down scrolls down
  assert.deepEqual(wheelToNotches(0, -100, 0), { dx: 0, dy: 1 });
  assert.deepEqual(wheelToNotches(0, 3, 0), { dx: 0, dy: -1 });
  assert.deepEqual(wheelToNotches(250, 0, 0), { dx: 3, dy: 0 });
  assert.deepEqual(wheelToNotches(0, 3, 1), { dx: 0, dy: -1 }); // lines
  assert.deepEqual(wheelToNotches(0, 0, 0), { dx: 0, dy: 0 });
});

test('wheelToNotches stays within the protocol limit', () => {
  assert.deepEqual(wheelToNotches(0, 1e9, 0), { dx: 0, dy: -100 });
  assert.deepEqual(wheelToNotches(Number.NaN, Infinity, 0), { dx: 0, dy: 0 });
});
