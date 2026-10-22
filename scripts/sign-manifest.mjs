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
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildSignedManifest } from './lib/sign.mjs';

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
  let signed;
  try {
    signed = await buildSignedManifest({
      installer: readFileSync(a.installer),
      version: a.version,
      url: a.url,
      notes: a.notes,
      privateKeyPem: readFileSync(a.key)
    });
  } catch (error) {
    fail(error.message);
  }

  const out = a.out ?? 'manifest.json';
  writeFileSync(out, signed.text);
  console.log(
    `wrote ${resolve(out)} (${signed.manifest.size} bytes installer, sha256 ${signed.manifest.sha256.slice(0, 12)}...)`
  );
} else {
  fail('usage: sign-manifest.mjs keygen <folder> | sign --key ... --installer ... --version ... --url ...');
}
