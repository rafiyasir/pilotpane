import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installerName, signRelease, zipName } from './release-flow.mjs';
import { formatSums } from './release.mjs';
import { loadProtocol, sha256Hex } from './sign.mjs';

const VERSION = '0.2.0';
const REPO = 'rafiyasir/pilotpane';
const template = readFileSync(new URL('../../docs/site/index.template.html', import.meta.url), 'utf8');
const { verifyManifest } = await import(
  pathToFileURL(fileURLToPath(new URL('../../apps/host/dist/main/updater/verify.js', import.meta.url))).href
);

function setup(overrides = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const installer = Buffer.from('MZ fake installer bytes');
  const zip = Buffer.from('PK fake zip bytes');
  const files = {
    [installerName(VERSION)]: installer,
    [zipName(VERSION)]: zip,
    SHA256SUMS: Buffer.from(
      formatSums([
        { name: installerName(VERSION), sha256: sha256Hex(installer) },
        { name: zipName(VERSION), sha256: sha256Hex(zip) }
      ])
    ),
    ...overrides
  };
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    options: {
      version: VERSION,
      repo: REPO,
      notes: ['Faster start'],
      privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      template,
      readAsset: async (name) => {
        const bytes = files[name];
        if (!bytes) throw new Error(`no such asset ${name}`);
        return bytes;
      },
      fetchJson: async () => [{ assets: [{ name: installerName(VERSION), download_count: 7 }] }]
    },
    installer
  };
}

test('signRelease writes a manifest the host accepts', async () => {
  const { options, publicKeyPem, installer } = setup();
  const result = await signRelease(options);
  const { parseUpdateManifest } = await loadProtocol();
  const parsed = parseUpdateManifest(result.manifestText);
  assert.ok(parsed.ok);
  assert.equal(parsed.manifest.version, VERSION);
  assert.equal(parsed.manifest.sha256, sha256Hex(installer));
  assert.equal(parsed.manifest.size, installer.length);
  assert.equal(
    parsed.manifest.url,
    `https://github.com/${REPO}/releases/download/v${VERSION}/${installerName(VERSION)}`
  );
  assert.equal(verifyManifest(parsed.manifest, publicKeyPem), true);
});

test('a manifest signed with another key is not accepted by the host check', async () => {
  const { options } = setup();
  const other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' });
  const { parseUpdateManifest } = await loadProtocol();
  const result = await signRelease(options);
  assert.equal(verifyManifest(parseUpdateManifest(result.manifestText).manifest, other), false);
});

test('signRelease renders the page with the release facts and the download count', async () => {
  const { options, installer } = setup();
  const result = await signRelease(options);
  assert.equal(result.downloads, 7);
  assert.match(result.pageHtml, new RegExp(sha256Hex(installer).slice(0, 16)));
  assert.match(result.pageHtml, /v0\.2\.0\/PilotPane-0\.2\.0-win-x64\.zip/);
  assert.doesNotMatch(result.pageHtml, /\{\{/);
});

test('signRelease refuses an installer that does not match SHA256SUMS', async () => {
  const { options } = setup({ [installerName(VERSION)]: Buffer.from('MZ swapped installer') });
  await assert.rejects(signRelease(options), /does not match SHA256SUMS/);
});

test('signRelease refuses a zip that does not match SHA256SUMS', async () => {
  const { options } = setup({ [zipName(VERSION)]: Buffer.from('PK swapped') });
  await assert.rejects(signRelease(options), /does not match SHA256SUMS/);
});

test('signRelease refuses when SHA256SUMS lacks the installer', async () => {
  const { options } = setup({
    SHA256SUMS: Buffer.from(formatSums([{ name: zipName(VERSION), sha256: 'a'.repeat(64) }]))
  });
  await assert.rejects(signRelease(options), /no entry for PilotPane-Setup/);
});

test('signRelease refuses an empty installer', async () => {
  const { options } = setup({
    [installerName(VERSION)]: Buffer.alloc(0),
    SHA256SUMS: Buffer.from(
      formatSums([
        { name: installerName(VERSION), sha256: sha256Hex(Buffer.alloc(0)) },
        { name: zipName(VERSION), sha256: sha256Hex(Buffer.from('PK fake zip bytes')) }
      ])
    )
  });
  await assert.rejects(signRelease(options), /is empty/);
});

test('a failing download count does not stop the release', async () => {
  const { options } = setup();
  const result = await signRelease({
    ...options,
    fetchJson: async () => {
      throw new Error('offline');
    }
  });
  assert.equal(result.downloads, 0);
  assert.match(result.pageHtml, /id="count" hidden/);
});
