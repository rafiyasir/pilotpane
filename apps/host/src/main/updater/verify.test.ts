import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { canonicalPayload, type UpdateManifest } from '@pilotpane/protocol';
import { compareVersions, inspectFile, verifyManifest } from './verify.js';

function makeKey() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { privateKey, publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString() };
}

function signed(privateKey: ReturnType<typeof makeKey>['privateKey']): UpdateManifest {
  const base = {
    version: '0.2.0',
    url: 'https://example.com/PilotPane-Setup-0.2.0.exe',
    sha256: 'c'.repeat(64),
    size: 1234,
    notes: ['One', 'Two']
  };
  const signature = sign(null, Buffer.from(canonicalPayload(base)), privateKey).toString('base64');
  return { ...base, signature };
}

test('a good signature verifies', () => {
  const k = makeKey();
  assert.equal(verifyManifest(signed(k.privateKey), k.publicPem), true);
});

test('changing any signed field breaks the signature', () => {
  const k = makeKey();
  const m = signed(k.privateKey);
  for (const patch of [
    { version: '9.9.9' },
    { url: 'https://evil.example.com/x.exe' },
    { sha256: 'd'.repeat(64) },
    { size: 1 },
    { notes: ['One'] }
  ]) {
    assert.equal(verifyManifest({ ...m, ...patch }, k.publicPem), false, JSON.stringify(patch));
  }
});

test('a signature from another key, or junk, does not verify and does not throw', () => {
  const a = makeKey();
  const b = makeKey();
  assert.equal(verifyManifest(signed(a.privateKey), b.publicPem), false);
  assert.equal(verifyManifest({ ...signed(a.privateKey), signature: 'AAAA' }, a.publicPem), false);
  assert.equal(verifyManifest(signed(a.privateKey), 'not a key'), false);
});

test('versions compare numerically', () => {
  assert.ok(compareVersions('0.2.0', '0.1.0') > 0);
  assert.ok(compareVersions('0.1.0', '0.2.0') < 0);
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  assert.ok(compareVersions('0.10.0', '0.9.0') > 0);
  assert.ok(compareVersions('1.0.0', '0.99.99') > 0);
});

test('inspectFile returns the SHA-256 and size', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pp-verify-'));
  try {
    const file = join(dir, 'abc.bin');
    writeFileSync(file, 'abc');
    const facts = await inspectFile(file);
    assert.equal(facts.size, 3);
    assert.equal(facts.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
