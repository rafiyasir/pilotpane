import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_PIN_ATTEMPTS, PIN_LOCK_SECONDS, pinProof } from '@pilotpane/protocol';
import { classify, isPrivateIPv4 } from './net/lan.js';
import { Pairing } from './pairing.js';
import { describeBrowser } from './session.js';

test('PIN is 6 digits', () => {
  const p = new Pairing();
  assert.match(p.pin, /^\d{6}$/);
});

test('correct proof pairs and the token resumes', () => {
  const p = new Pairing();
  const nonce = p.newNonce();
  const r = p.verify(nonce, pinProof(nonce, p.pin));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(p.resume(r.token), true);
  assert.equal(p.resume('made-up-token'), false);
});

test('a proof for another nonce fails', () => {
  const p = new Pairing();
  const r = p.verify(p.newNonce(), pinProof('other-nonce', p.pin));
  assert.equal(r.ok, false);
});

test('too many wrong PINs lock pairing, then it unlocks', () => {
  let now = 1_000_000;
  const p = new Pairing(() => now);
  const nonce = p.newNonce();
  for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) {
    const r = p.verify(nonce, 'wrong');
    assert.ok(!r.ok && r.reason === 'wrong-pin' && r.attemptsLeft === MAX_PIN_ATTEMPTS - i);
  }
  const locked = p.verify(nonce, 'wrong');
  assert.ok(!locked.ok && locked.reason === 'locked');
  // Even the right PIN is refused while locked.
  const stillLocked = p.verify(nonce, pinProof(nonce, p.pin));
  assert.ok(!stillLocked.ok && stillLocked.reason === 'locked');
  now += PIN_LOCK_SECONDS * 1000 + 1;
  assert.equal(p.verify(nonce, pinProof(nonce, p.pin)).ok, true);
});

test('a new PIN forgets earlier tokens', () => {
  const p = new Pairing();
  const nonce = p.newNonce();
  const r = p.verify(nonce, pinProof(nonce, p.pin));
  assert.ok(r.ok);
  p.newPin();
  if (r.ok) assert.equal(p.resume(r.token), false);
});

test('private address detection', () => {
  for (const ip of ['10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.12', '169.254.31.7']) {
    assert.equal(isPrivateIPv4(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '100.64.0.1', '127.0.0.1', 'abc', '1.2.3']) {
    assert.equal(isPrivateIPv4(ip), false, ip);
  }
});

test('adapter classification', () => {
  assert.equal(classify('Ethernet', '169.254.31.7'), 'ethernet');
  assert.equal(classify('Wi-Fi', '192.168.1.12'), 'wifi');
  assert.equal(classify('Local Area Connection* 10', '192.168.137.1'), 'hotspot');
  assert.equal(classify('Bluetooth Network Connection', '192.168.44.2'), 'bluetooth');
  assert.equal(classify('vEthernet (WSL)', '172.20.0.1'), 'virtual');
});

test('browser labels', () => {
  const win8 =
    'Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36';
  assert.equal(describeBrowser(win8), 'Chrome 109 on Windows 8');
});
