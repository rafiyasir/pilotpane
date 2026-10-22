// Small steps for the release workflow (.github/workflows/release.yml), kept in Node so they behave the same everywhere.
//
//   node scripts/release-ci.mjs check-tag <tag>        fails unless <tag> is v + the version in package.json
//   node scripts/release-ci.mjs sums <file>... --out F  writes a SHA256SUMS file for the given files
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTagMatchesVersion, formatSums } from './lib/release.mjs';
import { sha256Hex } from './lib/sign.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...rest] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (command === 'check-tag') {
  const tag = rest[0];
  if (!tag) fail('usage: check-tag <tag>');
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const result = checkTagMatchesVersion(tag, version);
  if (!result.ok) fail(result.reason);
  console.log(`tag ${tag} matches package.json`);
} else if (command === 'sums') {
  const outIndex = rest.indexOf('--out');
  if (outIndex === -1 || !rest[outIndex + 1]) fail('usage: sums <file>... --out <SHA256SUMS>');
  const out = rest[outIndex + 1];
  const files = rest.filter((_, i) => i !== outIndex && i !== outIndex + 1);
  if (files.length === 0) fail('no files to hash');
  const entries = files.map((file) => ({ name: basename(file), sha256: sha256Hex(readFileSync(file)) }));
  writeFileSync(out, formatSums(entries));
  console.log(`wrote ${out}`);
} else {
  fail('usage: release-ci.mjs check-tag <tag> | sums <file>... --out <file>');
}
