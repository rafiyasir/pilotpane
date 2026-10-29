import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseCodec, codecFamily } from './codec-choice.js';

const both = ['vp8', 'h264', 'vp9'];

test('VP8 first when it is offered and smooth', () => {
  assert.deepEqual(chooseCodec(both, { vp8: true, h264: true }), ['vp8', 'h264', 'vp9']);
});

test('H.264 first when VP8 is not smooth', () => {
  assert.deepEqual(chooseCodec(both, { vp8: false, h264: true }), ['h264', 'vp8', 'vp9']);
});

test('H.264 first when nothing is known', () => {
  assert.deepEqual(chooseCodec(both, {}), ['h264', 'vp8', 'vp9']);
  assert.deepEqual(chooseCodec(both, { vp8: null, h264: null }), ['h264', 'vp8', 'vp9']);
});

test('VP8 missing from the offer: H.264 first', () => {
  assert.deepEqual(chooseCodec(['h264', 'vp9'], { vp8: true }), ['h264', 'vp9']);
});

test('H.264 known not to work keeps the offer order', () => {
  assert.deepEqual(chooseCodec(['vp9', 'h264', 'vp8'], { vp8: false, h264: false }), ['vp9', 'h264', 'vp8']);
});

test('empty offer gives an empty order', () => {
  assert.deepEqual(chooseCodec([], { vp8: true }), []);
});

test('codecFamily maps mime types', () => {
  assert.equal(codecFamily('video/VP8'), 'vp8');
  assert.equal(codecFamily('video/H264'), 'h264');
  assert.equal(codecFamily('video/HEVC'), 'h265');
  assert.equal(codecFamily('video/rtx'), 'rtx');
  assert.equal(codecFamily('nonsense'), '');
});
