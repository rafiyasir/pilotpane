import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
  checkTagMatchesVersion,
  formatCount,
  formatSums,
  parseSums,
  renderDownloadPage,
  sumDownloads
} from './release.mjs';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'B'.repeat(64);

test('parseSums reads sha256sum lines and lowercases hashes', () => {
  const sums = parseSums(`${HASH_A}  PilotPane-Setup-0.2.0.exe\n${HASH_B} *PilotPane-0.2.0-win-x64.zip\n\n`);
  assert.equal(sums.get('PilotPane-Setup-0.2.0.exe'), HASH_A);
  assert.equal(sums.get('PilotPane-0.2.0-win-x64.zip'), HASH_B.toLowerCase());
  assert.equal(sums.size, 2);
});

test('parseSums rejects a line that is not a hash and a name', () => {
  assert.throws(() => parseSums('not a checksum line'), /line 1/);
  assert.throws(() => parseSums(`${HASH_A}`), /line 1/);
  assert.throws(() => parseSums(`${'z'.repeat(64)}  file.exe`), /line 1/);
});

test('formatSums output is read back by parseSums', () => {
  const text = formatSums([{ name: 'a b.exe', sha256: HASH_A }]);
  assert.equal(parseSums(text).get('a b.exe'), HASH_A);
});

test('checkTagMatchesVersion accepts v + version only', () => {
  assert.deepEqual(checkTagMatchesVersion('v0.2.0', '0.2.0'), { ok: true });
  assert.equal(checkTagMatchesVersion('v0.2.1', '0.2.0').ok, false);
  assert.equal(checkTagMatchesVersion('0.2.0', '0.2.0').ok, false);
  assert.equal(checkTagMatchesVersion('release-1', '0.2.0').ok, false);
  assert.match(checkTagMatchesVersion('v0.2.1', '0.2.0').reason, /does not match/);
});

test('sumDownloads adds installer and zip counts across releases', () => {
  const releases = [
    {
      assets: [
        { name: 'PilotPane-Setup-0.2.0.exe', download_count: 10 },
        { name: 'PilotPane-0.2.0-win-x64.zip', download_count: 3 },
        { name: 'SHA256SUMS', download_count: 99 }
      ]
    },
    { assets: [{ name: 'PilotPane-Setup-0.1.0.exe', download_count: 5 }] },
    { draft: true, assets: [{ name: 'PilotPane-Setup-0.3.0.exe', download_count: 40 }] }
  ];
  assert.equal(sumDownloads(releases), 18);
});

test('sumDownloads copes with missing or odd data', () => {
  assert.equal(sumDownloads(undefined), 0);
  assert.equal(sumDownloads({}), 0);
  assert.equal(sumDownloads([null, {}, { assets: null }, { assets: [null, { name: 5 }] }]), 0);
  assert.equal(
    sumDownloads([
      { assets: [{ name: 'a.exe', download_count: 'many' }, { name: 'b.exe' }, { name: 'c.exe', download_count: -4 }] }
    ]),
    0
  );
});

test('formatCount adds thousands separators', () => {
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(1284), '1,284');
  assert.equal(formatCount(1234567), '1,234,567');
});

test('the page script and the release script share the same functions', () => {
  const site = createRequire(import.meta.url)('../../docs/site/site.js');
  assert.equal(site.sumDownloads, sumDownloads);
  assert.equal(site.formatCount, formatCount);
});

const info = {
  repo: 'rafiyasir/pilotpane',
  version: '0.2.0',
  size: 66 * 1024 * 1024,
  sha256: 'ab'.repeat(32),
  installerUrl: 'https://github.com/rafiyasir/pilotpane/releases/download/v0.2.0/PilotPane-Setup-0.2.0.exe',
  zipUrl: 'https://github.com/rafiyasir/pilotpane/releases/download/v0.2.0/PilotPane-0.2.0-win-x64.zip',
  downloads: 1284
};

test('renderDownloadPage fills the placeholders', () => {
  const html = renderDownloadPage(
    'v{{version}} {{size_mb}} {{sha_short}} {{downloads}}|{{count_hidden}}|{{installer_url}}',
    info
  );
  assert.equal(html, `v0.2.0 66 MB ${'ab'.repeat(8)}… 1,284||${info.installerUrl}`);
});

test('renderDownloadPage hides the count line when there are no downloads', () => {
  assert.equal(renderDownloadPage('[{{count_hidden}}]', { ...info, downloads: 0 }), '[hidden]');
  assert.equal(renderDownloadPage('[{{count_hidden}}]', { ...info, downloads: undefined }), '[hidden]');
});

test('renderDownloadPage escapes values and refuses unknown placeholders and bad input', () => {
  assert.equal(renderDownloadPage('{{repo}}', { ...info, repo: 'a/b' }), 'a/b');
  assert.throws(() => renderDownloadPage('{{nope}}', info), /nope/);
  assert.throws(() => renderDownloadPage('', { ...info, version: '0.2' }), /version/);
  assert.throws(() => renderDownloadPage('', { ...info, sha256: 'abc' }), /sha256/);
  assert.throws(() => renderDownloadPage('', { ...info, size: 0 }), /size/);
  assert.throws(() => renderDownloadPage('', { ...info, installerUrl: 'http://example.com/a.exe' }), /https/);
  assert.throws(() => renderDownloadPage('', { ...info, repo: 'x"><script>' }), /repo/);
});

test('the real template renders with every placeholder filled', () => {
  const template = readFileSync(new URL('../../docs/site/index.template.html', import.meta.url), 'utf8');
  const html = renderDownloadPage(template, info);
  assert.doesNotMatch(html, /\{\{/);
  assert.match(
    html,
    /href="https:\/\/github\.com\/rafiyasir\/pilotpane\/releases\/download\/v0\.2\.0\/PilotPane-Setup-0\.2\.0\.exe"/
  );
  assert.match(html, />0\.2\.0</);
  assert.match(html, /66 MB/);
  assert.match(html, /1,284/);
  // Privacy and CSP: no inline style attributes, and only the GitHub API as a network target.
  assert.doesNotMatch(html, /\sstyle=/);
  assert.match(html, /connect-src https:\/\/api\.github\.com;/);
  assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)/);
});
