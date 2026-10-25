import { sha256Hex } from './sha256.js';

/**
 * The viewer never sends the PIN itself. The host sends a random nonce in
 * "hello", the viewer answers with this proof, and the host computes the same
 * value to compare. Someone watching the LAN sees only a one-time hash.
 */
export function pinProof(nonce: string, pin: string): string {
  return sha256Hex(`pilotpane-pin:v1:${nonce}:${pin}`);
}

/** Compares two strings in time that does not depend on where they differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isPinShaped(value: string, length: number): boolean {
  return value.length === length && /^[0-9]+$/.test(value);
}
