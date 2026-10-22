import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_MANIFEST_BYTES, MAX_UPDATE_BYTES, canonicalPayload, parseUpdateManifest } from './update.js';

const good = {
  version: '0.2.0',
  url: 'https://example.github.io/pilotpane/update/PilotPane-Setup-0.2.0.exe',
  sha256: 'a'.repeat(64),
  size: 66_000_000,
  notes: ['Faster start', 'Fixes a tray bug'],
  signature: 'A'.repeat(86) + '=='
};

const parse = (o: unknown) => parseUpdateManifest(JSON.stringify(o));

test('a valid manifest parses', () => {
  const r = parse(good);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.manifest, good);
});

test('http on 127.0.0.1 is allowed for local tests, other http is not', () => {
  assert.equal(parse({ ...good, url: 'http://127.0.0.1:8080/setup.exe' }).ok, true);
  assert.equal(parse({ ...good, url: 'http://example.com/setup.exe' }).ok, false);
  assert.equal(parse({ ...good, url: 'http://127.0.0.1.evil.com/setup.exe' }).ok, false);
});

test('bad fields are rejected with a reason', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['bad version', { version: '1.2' }],
    ['bad version', { version: 'v1.2.3' }],
    ['bad url', { url: 'ftp://example.com/x.exe' }],
    ['bad url', { url: 'https://user@example.com/x.exe' }],
    ['bad url', { url: 'https://example.com/a b.exe' }],
    ['bad sha256', { sha256: 'A'.repeat(64) }],
    ['bad sha256', { sha256: 'a'.repeat(63) }],
    ['bad size', { size: 0 }],
    ['bad size', { size: 1.5 }],
    ['bad size', { size: MAX_UPDATE_BYTES + 1 }],
    ['bad size', { size: '5' }],
    ['bad notes', { notes: ['a', 'b', 'c', 'd'] }],
    ['bad notes', { notes: ['x'.repeat(121)] }],
    ['bad notes', { notes: ['two\nlines'] }],
    ['bad notes', { notes: 'text' }],
    ['bad signature', { signature: 'abc' }]
  ];
  for (const [reason, patch] of cases) {
    const r = parse({ ...good, ...patch });
    assert.equal(r.ok, false, JSON.stringify(patch));
    if (!r.ok) assert.equal(r.reason, reason, JSON.stringify(patch));
  }
});

test('missing fields, junk and oversized text are rejected without throwing', () => {
  for (const key of Object.keys(good)) {
    const { [key]: _omitted, ...rest } = good as Record<string, unknown>;
    assert.equal(parse(rest).ok, false, `missing ${key}`);
  }
  assert.equal(parseUpdateManifest('not json').ok, false);
  assert.equal(parseUpdateManifest('[]').ok, false);
  assert.equal(parseUpdateManifest('null').ok, false);
  assert.equal(parseUpdateManifest(' '.repeat(MAX_MANIFEST_BYTES + 1)).ok, false);
});

test('the signed payload changes when any field changes', () => {
  const { signature: _sig, ...base } = good;
  const payload = canonicalPayload(base);
  assert.equal(payload.split('\n')[0], 'pilotpane-update:v1');
  for (const patch of [
    { version: '0.2.1' },
    { url: base.url + '2' },
    { sha256: 'b'.repeat(64) },
    { size: base.size + 1 },
    { notes: ['Faster start'] }
  ]) {
    assert.notEqual(canonicalPayload({ ...base, ...patch }), payload, JSON.stringify(patch));
  }
});
