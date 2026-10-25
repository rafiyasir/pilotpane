// Signing of the update manifest, shared by sign-manifest.mjs and release-sign.mjs. Plain Node, no packages.
//
// The signed text comes from canonicalPayload() in packages/protocol, so the host verifies exactly what is signed here.
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The compiled protocol package. Run `pnpm build` first. */
export function loadProtocol() {
  return import(pathToFileURL(join(root, 'packages/protocol/dist/index.js')).href);
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Hashes the installer bytes and signs a manifest for them.
 * Returns { text, manifest }. Throws if the host would reject the result.
 */
export async function buildSignedManifest({ installer, version, url, notes, privateKeyPem }) {
  const { canonicalPayload, parseUpdateManifest } = await loadProtocol();
  const unsigned = { version, url, sha256: sha256Hex(installer), size: installer.length, notes };
  const key = createPrivateKey(privateKeyPem);
  const signature = sign(null, Buffer.from(canonicalPayload(unsigned), 'utf8'), key).toString('base64');
  const text = JSON.stringify({ ...unsigned, signature }, null, 2) + '\n';

  const check = parseUpdateManifest(text);
  if (!check.ok) throw new Error(`manifest would be rejected by the host: ${check.reason}`);
  return { text, manifest: check.manifest };
}
