/**
 * Pairing rules: a 6-digit PIN shown on the host, proven by the viewer with a
 * hash over a one-time nonce. Too many wrong tries pause pairing for a while.
 * A successful pairing returns a token so the same viewer can reconnect after
 * a network drop without typing the PIN again (until the PIN changes).
 */
import { randomBytes, randomInt } from 'node:crypto';
import {
  MAX_PIN_ATTEMPTS,
  PIN_LENGTH,
  PIN_LOCK_SECONDS,
  constantTimeEqual,
  pinProof
} from '@pilotpane/protocol';

export type VerifyResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'wrong-pin' | 'locked'; attemptsLeft: number; retryAfterSec: number };

export class Pairing {
  private currentPin = '';
  private wrongAttempts = 0;
  private lockedUntilMs = 0;
  private readonly tokens = new Set<string>();

  constructor(private readonly now: () => number = Date.now) {
    this.newPin();
  }

  get pin(): string {
    return this.currentPin;
  }

  /** Null when pairing is not paused. */
  get lockedUntil(): number | null {
    return this.lockedUntilMs > this.now() ? this.lockedUntilMs : null;
  }

  /** Makes a fresh PIN and forgets every earlier pairing. */
  newPin(): string {
    this.currentPin = String(randomInt(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, '0');
    this.tokens.clear();
    this.wrongAttempts = 0;
    this.lockedUntilMs = 0;
    return this.currentPin;
  }

  newNonce(): string {
    return randomBytes(16).toString('hex');
  }

  verify(nonce: string, proof: string): VerifyResult {
    const now = this.now();
    if (this.lockedUntilMs > now) {
      return { ok: false, reason: 'locked', attemptsLeft: 0, retryAfterSec: Math.ceil((this.lockedUntilMs - now) / 1000) };
    }
    if (this.lockedUntilMs !== 0) {
      // The pause is over: start counting again.
      this.lockedUntilMs = 0;
      this.wrongAttempts = 0;
    }

    if (constantTimeEqual(pinProof(nonce, this.currentPin), proof.toLowerCase())) {
      this.wrongAttempts = 0;
      const token = randomBytes(24).toString('base64url');
      this.tokens.add(token);
      return { ok: true, token };
    }

    this.wrongAttempts += 1;
    if (this.wrongAttempts >= MAX_PIN_ATTEMPTS) {
      this.lockedUntilMs = now + PIN_LOCK_SECONDS * 1000;
      return { ok: false, reason: 'locked', attemptsLeft: 0, retryAfterSec: PIN_LOCK_SECONDS };
    }
    return { ok: false, reason: 'wrong-pin', attemptsLeft: MAX_PIN_ATTEMPTS - this.wrongAttempts, retryAfterSec: 0 };
  }

  /** True if this token came from a successful pairing with the current PIN. */
  resume(token: string): boolean {
    for (const t of this.tokens) if (constantTimeEqual(t, token)) return true;
    return false;
  }
}
