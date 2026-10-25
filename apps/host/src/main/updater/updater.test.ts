import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { canonicalPayload, type UpdateState } from '@pilotpane/protocol';
import { Updater, type UpdaterOptions } from './updater.js';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const SHA = 'e'.repeat(64);

/** A manifest text. `goodSignature: false` signs something else, so verification fails. */
function manifestText(over: Record<string, unknown> = {}, goodSignature = true): string {
  const base = {
    version: '0.2.0',
    url: 'https://example.com/PilotPane-Setup-0.2.0.exe',
    sha256: SHA,
    size: 1000,
    notes: ['Faster start'],
    ...over
  };
  const signed = goodSignature ? canonicalPayload(base as never) : 'something else';
  const signature = sign(null, Buffer.from(signed), privateKey).toString('base64');
  return JSON.stringify({ ...base, signature });
}

function setup(over: Partial<UpdaterOptions> = {}) {
  const states: UpdateState[] = [];
  const removed: string[] = [];
  const calls = { fetch: 0, download: 0 };
  const updater = new Updater({
    currentVersion: '0.1.0',
    manifestUrl: 'https://example.com/manifest.json',
    publicKey: publicPem,
    downloadDir: 'tmp',
    fetchText: async () => {
      calls.fetch++;
      return manifestText();
    },
    download: async (_url, _dest, _max, onProgress) => {
      calls.download++;
      onProgress(500);
      onProgress(1000);
    },
    inspect: async () => ({ sha256: SHA, size: 1000 }),
    remove: async (p) => {
      removed.push(p);
    },
    onState: (s) => states.push(s),
    ...over
  });
  return { updater, states, removed, calls };
}

test('nothing happens until check() is called', () => {
  const { updater, calls } = setup();
  assert.deepEqual(updater.state, { phase: 'idle' });
  assert.equal(calls.fetch, 0);
  assert.equal(calls.download, 0);
});

test('a newer signed manifest becomes "available"', async () => {
  const { updater } = setup();
  await updater.check();
  assert.deepEqual(updater.state, { phase: 'available', version: '0.2.0', notes: ['Faster start'] });
});

test('the same or an older version is "up to date" and offers no download', async () => {
  for (const version of ['0.1.0', '0.0.9']) {
    const { updater, calls } = setup({ fetchText: async () => manifestText({ version }) });
    await updater.check();
    assert.deepEqual(updater.state, { phase: 'up-to-date' });
    await updater.download();
    assert.equal(calls.download, 0);
  }
});

test('a network error fails with "offline"', async () => {
  const { updater } = setup({
    fetchText: async () => {
      throw new Error('ENOTFOUND');
    }
  });
  await updater.check();
  assert.deepEqual(updater.state, { phase: 'failed', reason: 'offline' });
});

test('junk manifests fail with "bad-manifest"', async () => {
  const { updater } = setup({ fetchText: async () => '<html>404</html>' });
  await updater.check();
  assert.deepEqual(updater.state, { phase: 'failed', reason: 'bad-manifest' });
});

test('a bad signature fails and nothing can be downloaded', async () => {
  const { updater, calls } = setup({ fetchText: async () => manifestText({}, false) });
  await updater.check();
  assert.deepEqual(updater.state, { phase: 'failed', reason: 'bad-signature' });
  await updater.download();
  assert.equal(calls.download, 0);
});

test('a field changed after signing fails the signature', async () => {
  const tampered = JSON.stringify({ ...JSON.parse(manifestText()), url: 'https://evil.example.com/x.exe' });
  const { updater } = setup({ fetchText: async () => tampered });
  await updater.check();
  assert.deepEqual(updater.state, { phase: 'failed', reason: 'bad-signature' });
});

test('download then verify ends in "ready" with the installer path', async () => {
  const { updater, states } = setup();
  await updater.check();
  await updater.download();
  assert.deepEqual(updater.state, { phase: 'ready', version: '0.2.0' });
  assert.equal(updater.readyInstaller, 'tmp/PilotPane-Setup-0.2.0.exe');
  assert.ok(states.some((s) => s.phase === 'downloading'));
  assert.ok(states.some((s) => s.phase === 'verifying'));
});

test('a hash mismatch deletes the file and fails with "bad-download"', async () => {
  const { updater, removed } = setup({ inspect: async () => ({ sha256: 'f'.repeat(64), size: 1000 }) });
  await updater.check();
  await updater.download();
  assert.deepEqual(updater.state, { phase: 'failed', reason: 'bad-download' });
  assert.deepEqual(removed, ['tmp/PilotPane-Setup-0.2.0.exe']);
  assert.equal(updater.readyInstaller, null);
});

test('a size mismatch is rejected like a hash mismatch', async () => {
  const { updater, removed } = setup({ inspect: async () => ({ sha256: SHA, size: 1001 }) });
  await updater.check();
  await updater.download();
  assert.deepEqual(updater.state, { phase: 'failed', reason: 'bad-download' });
  assert.equal(removed.length, 1);
});

test('the download is capped at the signed size', async () => {
  let cap = 0;
  const { updater } = setup({
    download: async (_u, _d, max) => {
      cap = max;
    }
  });
  await updater.check();
  await updater.download();
  assert.equal(cap, 1000);
});

test('a download error removes the partial file and fails with "download-failed"', async () => {
  const { updater, removed } = setup({
    download: async () => {
      throw new Error('too big');
    }
  });
  await updater.check();
  await updater.download();
  assert.deepEqual(updater.state, { phase: 'failed', reason: 'download-failed' });
  assert.equal(removed.length, 1);
});

test('a second check while one is running does not start another', async () => {
  let release: (text: string) => void = () => {};
  let fetches = 0;
  const { updater } = setup({
    fetchText: () => {
      fetches++;
      return new Promise<string>((resolve) => (release = resolve));
    }
  });
  const first = updater.check();
  await updater.check();
  assert.equal(updater.state.phase, 'checking');
  release(manifestText());
  await first;
  assert.equal(fetches, 1);
  assert.equal(updater.state.phase, 'available');
});

test('"Later" returns to idle, but a running download is not cancelled', async () => {
  const { updater } = setup();
  await updater.check();
  updater.dismiss();
  assert.deepEqual(updater.state, { phase: 'idle' });

  let release: () => void = () => {};
  const slow = setup({ download: () => new Promise<void>((resolve) => (release = resolve)) });
  await slow.updater.check();
  const running = slow.updater.download();
  slow.updater.dismiss();
  assert.equal(slow.updater.state.phase, 'downloading');
  release();
  await running;
  assert.equal(slow.updater.state.phase, 'ready');
});
