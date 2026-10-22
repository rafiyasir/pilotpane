// Release-time helper for in-app updates. Plain Node, no packages.
//
//   node scripts/sign-manifest.mjs keygen <folder>
//       Writes <folder>/update-private.pem and prints the public key to paste
//       into apps/host/src/main/updater/config.ts. Keep the private key out of the repo.
//
//   node scripts/sign-manifest.mjs sign --key <private.pem> --installer <Setup.exe> \
//       --version 0.2.0 --url <https url of the installer> [--note "text"]... [--out manifest.json]
//       Hashes the installer, signs the manifest and writes it.
//
// The signed text comes from canonicalPayload() in packages/protocol, so the host verifies exactly what is signed here.
import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { canonicalPayload, parseUpdateManifest } = await import(
  pathToFileURL(join(root, 'packages/protocol/dist/index.js')).href
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { notes: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) fail(`unexpected argument: ${arg}`);
    const value = argv[++i];
    if (value === undefined) fail(`${arg} needs a value`);
    if (arg === '--note') out.notes.push(value);
    else out[arg.slice(2)] = value;
  }
  return out;
}

const [command, ...rest] = process.argv.slice(2);

if (command === 'keygen') {
  const folder = rest[0];
  if (!folder) fail('usage: keygen <folder>');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  mkdirSync(folder, { recursive: true });
  const file = join(folder, 'update-private.pem');
  writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx' });
  console.log(`private key written to ${resolve(file)} (keep it secret, never commit it)`);
  console.log('public key for config.ts:\n');
  console.log(publicKey.export({ type: 'spki', format: 'pem' }));
} else if (command === 'sign') {
  const a = parseArgs(rest);
  for (const need of ['key', 'installer', 'version', 'url']) if (!a[need]) fail(`missing --${need}`);
  const installer = readFileSync(a.installer);
  const unsigned = {
    version: a.version,
    url: a.url,
    sha256: createHash('sha256').update(installer).digest('hex'),
    size: statSync(a.installer).size,
    notes: a.notes
  };
  const key = createPrivateKey(readFileSync(a.key));
  const signature = sign(null, Buffer.from(canonicalPayload(unsigned), 'utf8'), key).toString('base64');
  const text = JSON.stringify({ ...unsigned, signature }, null, 2) + '\n';

  const check = parseUpdateManifest(text);
  if (!check.ok) fail(`manifest would be rejected by the host: ${check.reason}`);

  const out = a.out ?? 'manifest.json';
  writeFileSync(out, text);
  console.log(`wrote ${resolve(out)} (${unsigned.size} bytes installer, sha256 ${unsigned.sha256.slice(0, 12)}...)`);
} else {
  fail('usage: sign-manifest.mjs keygen <folder> | sign --key ... --installer ... --version ... --url ...');
}
