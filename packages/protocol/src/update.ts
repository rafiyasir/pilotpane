/**
 * The signed update manifest. It is not a LAN message: the host fetches it
 * from the project's GitHub Pages site after the user clicks "Check for
 * updates". It lives here so the parser and the signed bytes have one home.
 * No `node:` imports; the signature itself is checked in the host.
 */

/** Largest manifest text the host accepts. */
export const MAX_MANIFEST_BYTES = 8 * 1024;

/** Largest installer the host will download. */
export const MAX_UPDATE_BYTES = 300 * 1024 * 1024;

export const MAX_UPDATE_NOTES = 3;
export const MAX_UPDATE_NOTE_CHARS = 120;

export interface UpdateManifest {
  /** `x.y.z` */
  version: string;
  /** https, or http on 127.0.0.1 for local tests. */
  url: string;
  /** Lowercase hex SHA-256 of the installer. */
  sha256: string;
  /** Installer size in bytes. */
  size: number;
  notes: string[];
  /** Base64 Ed25519 signature over `canonicalPayload`. */
  signature: string;
}

export type ManifestResult = { ok: true; manifest: UpdateManifest } | { ok: false; reason: string };

/**
 * The exact text that is signed. Fixed field order, one value per line, so the
 * signer and the verifier cannot disagree. Parsing rejects newlines in values.
 */
export function canonicalPayload(m: Omit<UpdateManifest, 'signature'>): string {
  return ['pilotpane-update:v1', m.version, m.url, m.sha256, String(m.size), String(m.notes.length), ...m.notes].join(
    '\n'
  );
}

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const ED25519_BASE64 = /^[A-Za-z0-9+/]{86}==$/;
const HTTPS_URL = /^https:\/\/[^\s@]+$/;
const LOOPBACK_URL = /^http:\/\/127\.0\.0\.1(:\d{1,5})?\/[^\s@]*$/;

/** Checks the shape of a manifest. It does not check the signature. */
export function parseUpdateManifest(raw: string): ManifestResult {
  if (raw.length > MAX_MANIFEST_BYTES) return { ok: false, reason: 'manifest is too large' };
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'manifest is not JSON' };
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    return { ok: false, reason: 'manifest is not an object' };
  const m = v as Record<string, unknown>;

  const { version, url, sha256, size, notes, signature } = m;
  if (typeof version !== 'string' || !VERSION.test(version)) return { ok: false, reason: 'bad version' };
  if (typeof url !== 'string' || url.length > 512 || !(HTTPS_URL.test(url) || LOOPBACK_URL.test(url))) {
    return { ok: false, reason: 'bad url' };
  }
  if (typeof sha256 !== 'string' || !SHA256_HEX.test(sha256)) return { ok: false, reason: 'bad sha256' };
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > MAX_UPDATE_BYTES) {
    return { ok: false, reason: 'bad size' };
  }
  if (!Array.isArray(notes) || notes.length > MAX_UPDATE_NOTES) return { ok: false, reason: 'bad notes' };
  for (const note of notes) {
    if (typeof note !== 'string' || note.length === 0 || note.length > MAX_UPDATE_NOTE_CHARS || /[\r\n]/.test(note)) {
      return { ok: false, reason: 'bad notes' };
    }
  }
  if (typeof signature !== 'string' || !ED25519_BASE64.test(signature)) return { ok: false, reason: 'bad signature' };

  return { ok: true, manifest: { version, url, sha256, size, notes: [...(notes as string[])], signature } };
}
