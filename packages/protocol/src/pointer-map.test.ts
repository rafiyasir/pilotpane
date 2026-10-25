import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toHostCoords, videoBox, WheelAccumulator } from './pointer-map.js';

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

test('a mouse wheel click is one notch and down scrolls down', () => {
  const w = new WheelAccumulator();
  assert.deepEqual(w.add(0, 100, 0, 1000), { dx: 0, dy: -1 });
  assert.deepEqual(w.add(0, -100, 0, 2000), { dx: 0, dy: 1 });
  assert.deepEqual(w.add(250, 0, 0, 3000), { dx: 2, dy: 0 }); // 0.5 is kept
  assert.deepEqual(w.add(0, 3, 1, 4000), { dx: 0, dy: -1 }); // 3 lines are one notch
  assert.deepEqual(w.add(0, 0, 0, 5000), { dx: 0, dy: 0 });
});

test('tiny touchpad deltas add up instead of each being a notch', () => {
  const w = new WheelAccumulator();
  let total = 0;
  for (let i = 0; i < 40; i += 1) total += w.add(0, 4, 0, 1000 + i * 8).dy; // 160 px in 40 events
  assert.equal(total, -1);
});

test('a pause or a turn-around forgets the leftover', () => {
  const w = new WheelAccumulator();
  assert.deepEqual(w.add(0, 60, 0, 1000), { dx: 0, dy: 0 });
  assert.deepEqual(w.add(0, 60, 0, 5000), { dx: 0, dy: 0 }); // long pause: 60 not 120
  assert.deepEqual(w.add(0, -60, 0, 5050), { dx: 0, dy: 0 }); // turned around
  assert.deepEqual(w.add(0, -60, 0, 5100), { dx: 0, dy: 1 });
});

test('the wheel stays within the protocol limit', () => {
  const w = new WheelAccumulator();
  assert.deepEqual(w.add(0, 1e9, 0, 1000), { dx: 0, dy: -100 });
  assert.deepEqual(new WheelAccumulator().add(Number.NaN, Infinity, 0, 1000), { dx: 0, dy: 0 });
});
