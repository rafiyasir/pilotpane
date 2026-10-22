/**
 * Checks for the update flow: the manifest signature, version order and the
 * downloaded file. Node only, no Electron, so it runs under `node --test`.
 */
import { createHash, createPublicKey, verify } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { canonicalPayload, type UpdateManifest } from '@pilotpane/protocol';

/** True only if `manifest.signature` is a valid Ed25519 signature by `publicKeyPem` over the canonical payload. */
export function verifyManifest(manifest: UpdateManifest, publicKeyPem: string): boolean {
  try {
    const { signature, ...unsigned } = manifest;
    const data = Buffer.from(canonicalPayload(unsigned), 'utf8');
    return verify(null, data, createPublicKey(publicKeyPem), Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

/** Negative if a < b, 0 if equal, positive if a > b. Both are `x.y.z`. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface FileFacts {
  sha256: string;
  size: number;
}

/** Hashes a file without loading it all into memory. */
export function inspectFile(path: string): Promise<FileFacts> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    let size = 0;
    createReadStream(path)
      .on('data', (chunk) => {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        size += buf.length;
        hash.update(buf);
      })
      .on('error', reject)
      .on('end', () => resolve({ sha256: hash.digest('hex'), size }));
  });
}
