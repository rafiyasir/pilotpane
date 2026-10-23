import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUALITY_PRESETS, QUALITY_SPECS, isQualityPreset } from './constants.js';
import { MAX_MESSAGE_BYTES, parseHostMessage, parseViewerMessage } from './parse.js';

test('valid viewer messages parse', () => {
  assert.deepEqual(parseViewerMessage('{"type":"pair","proof":"ab"}'), { type: 'pair', proof: 'ab' });
  assert.deepEqual(parseViewerMessage('{"type":"set-quality","preset":"720p"}'), {
    type: 'set-quality',
    preset: '720p'
  });
  assert.deepEqual(parseViewerMessage('{"type":"ice","candidate":null}'), { type: 'ice', candidate: null });
  assert.deepEqual(parseViewerMessage('{"type":"ice","candidate":{"candidate":"c","sdpMid":"0","sdpMLineIndex":0}}'), {
    type: 'ice',
    candidate: { candidate: 'c', sdpMid: '0', sdpMLineIndex: 0 }
  });
});

test('the low preset is accepted in both directions and unknown presets are not', () => {
  assert.deepEqual(parseViewerMessage('{"type":"set-quality","preset":"low"}'), { type: 'set-quality', preset: 'low' });
  assert.deepEqual(parseHostMessage('{"type":"quality","preset":"low"}'), { type: 'quality', preset: 'low' });
  assert.equal(parseHostMessage('{"type":"quality","preset":"480p"}'), null);
  assert.equal(isQualityPreset('low'), true);
  assert.equal(isQualityPreset('480p'), false);
  for (const preset of QUALITY_PRESETS) assert.ok(QUALITY_SPECS[preset].maxFramerate > 0);
  assert.ok(QUALITY_SPECS.low.maxBitrate < QUALITY_SPECS['720p'].minBitrate);
});

test('invalid viewer messages are rejected', () => {
  assert.equal(parseViewerMessage('not json'), null);
  assert.equal(parseViewerMessage('[]'), null);
  assert.equal(parseViewerMessage('{"type":"unknown"}'), null);
  assert.equal(parseViewerMessage('{"type":"pair","proof":42}'), null);
  assert.equal(parseViewerMessage('{"type":"set-quality","preset":"4k"}'), null);
  assert.equal(parseViewerMessage('{"type":"ice","candidate":{"candidate":1}}'), null);
  assert.equal(parseViewerMessage(JSON.stringify({ type: 'answer', sdp: 'x'.repeat(MAX_MESSAGE_BYTES) })), null);
});

test('host messages parse and reject', () => {
  assert.deepEqual(parseHostMessage('{"type":"busy"}'), { type: 'busy' });
  assert.deepEqual(parseHostMessage('{"type":"bye","reason":"new-pin"}'), { type: 'bye', reason: 'new-pin' });
  assert.equal(parseHostMessage('{"type":"bye","reason":"other"}'), null);
  assert.equal(parseHostMessage('{"type":"hello","protocol":1}'), null);
});
