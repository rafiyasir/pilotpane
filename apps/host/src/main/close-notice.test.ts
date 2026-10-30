import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeDecision } from './close-notice.js';

test('the first close is held', () => {
  assert.equal(closeDecision({ quitting: false, noticeSeen: false, noticeShowing: false }), 'hold');
});

test('a close after the notice was seen just hides the window', () => {
  assert.equal(closeDecision({ quitting: false, noticeSeen: true, noticeShowing: false }), 'hide');
});

test('closing again while the card shows counts as keep in tray', () => {
  assert.equal(closeDecision({ quitting: false, noticeSeen: false, noticeShowing: true }), 'hide');
});

test('quitting always lets the window close', () => {
  assert.equal(closeDecision({ quitting: true, noticeSeen: false, noticeShowing: false }), 'quit');
  assert.equal(closeDecision({ quitting: true, noticeSeen: true, noticeShowing: true }), 'quit');
});
