import { createHash, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sha256, sha256Hex, toHex } from './sha256.js';
import { constantTimeEqual, pinProof } from './pin.js';

const nodeHex = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

test('known vectors', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('matches node:crypto for every length 0..300', () => {
  for (let len = 0; len <= 300; len++) {
    const data = new Uint8Array(randomBytes(len));
    assert.equal(toHex(sha256(data)), nodeHex(data), `length ${len}`);
  }
});

test('matches node:crypto for a 1 MB input', () => {
  const data = new Uint8Array(randomBytes(1024 * 1024));
  assert.equal(toHex(sha256(data)), nodeHex(data));
});

test('UTF-8 text', () => {
  const text = 'पायलट पेन ✓';
  assert.equal(sha256Hex(text), createHash('sha256').update(text, 'utf8').digest('hex'));
});

test('pin proof depends on nonce and pin', () => {
  const a = pinProof('nonce1', '482913');
  assert.equal(a.length, 64);
  assert.notEqual(a, pinProof('nonce2', '482913'));
  assert.notEqual(a, pinProof('nonce1', '482914'));
  assert.equal(a, pinProof('nonce1', '482913'));
});

test('constantTimeEqual', () => {
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abd'), false);
  assert.equal(constantTimeEqual('abc', 'ab'), false);
});
