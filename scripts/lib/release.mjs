// Pure helpers for the release scripts. No network, no file access, so they run under plain `node --test`.
import { createRequire } from 'node:module';

// The download page script holds the count logic; loading it here keeps one implementation.
const site = createRequire(import.meta.url)('../../docs/site/site.js');

/** Total downloads across published releases (installer and zip only). */
export const sumDownloads = site.sumDownloads;
/** 1284 -> "1,284". */
export const formatCount = site.formatCount;

const SHA256_HEX = /^[0-9a-f]{64}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const SUMS_LINE = /^([0-9a-fA-F]{64}) [ *](.+)$/;
const TAG = /^v\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/;

/** Reads `sha256sum` style text ("<hash>  <file name>" per line) into a Map of file name to lowercase hash. */
export function parseSums(text) {
  const sums = new Map();
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === '') return;
    const match = SUMS_LINE.exec(line);
    if (!match) throw new Error(`SHA256SUMS line ${index + 1} is not "<sha256>  <file name>"`);
    sums.set(match[2], match[1].toLowerCase());
  });
  return sums;
}

/** Writes the same format from [{ name, sha256 }]. */
export function formatSums(entries) {
  return entries.map((e) => `${e.sha256}  ${e.name}\n`).join('');
}

/** A release tag must be `v` plus the version in package.json. */
export function checkTagMatchesVersion(tag, version) {
  if (!TAG.test(tag)) return { ok: false, reason: `tag "${tag}" is not like v1.2.3` };
  if (tag !== `v${version}`) return { ok: false, reason: `tag ${tag} does not match package.json version ${version}` };
  return { ok: true };
}

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

/**
 * Fills `{{name}}` placeholders in the page template. Every value is HTML-escaped.
 * Refuses bad input, so a broken release cannot produce a page with a dead download button.
 * info: { repo, version, size, sha256, installerUrl, zipUrl, downloads }
 */
export function renderDownloadPage(template, info) {
  if (!VERSION.test(info.version)) throw new Error(`bad version: ${info.version}`);
  if (!SHA256_HEX.test(info.sha256)) throw new Error('bad sha256');
  if (!Number.isInteger(info.size) || info.size <= 0) throw new Error('bad size');
  if (!/^[\w.-]+\/[\w.-]+$/.test(info.repo)) throw new Error(`bad repo: ${info.repo}`);
  for (const key of ['installerUrl', 'zipUrl']) {
    if (!String(info[key]).startsWith('https://')) throw new Error(`${key} must be an https URL`);
  }
  const downloads = Number.isInteger(info.downloads) && info.downloads > 0 ? info.downloads : 0;
  const values = {
    repo: info.repo,
    version: info.version,
    size_mb: `${Math.max(1, Math.round(info.size / (1024 * 1024)))} MB`,
    sha256: info.sha256,
    sha_short: `${info.sha256.slice(0, 16)}…`,
    installer_url: info.installerUrl,
    zip_url: info.zipUrl,
    downloads: formatCount(downloads),
    count_hidden: downloads > 0 ? '' : 'hidden'
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (!(name in values)) throw new Error(`template placeholder {{${name}}} has no value`);
    return escapeHtml(values[name]);
  });
}
