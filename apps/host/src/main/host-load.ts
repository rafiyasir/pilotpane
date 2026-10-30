import type { LoadLevel } from '@pilotpane/protocol';

/** How long the encoder must report a CPU limit before the stream steps down. */
export const LOAD_DOWN_AFTER_MS = 5_000;
/** How long the encoder must be free of a CPU limit before the stream steps back up. */
export const LOAD_UP_AFTER_MS = 30_000;
/** Minimum time between two changes, so the picture does not flap. */
export const LOAD_MIN_GAP_MS = 15_000;
export const MAX_LOAD_LEVEL: LoadLevel = 2;

/**
 * Steps the stream down when the host CPU limits the encoder (a busy host starves it and the
 * pointer lags) and back up when that clears. It sets a ceiling inside the engine; the viewer's
 * own preset and Auto work below it and never see it.
 */
export class HostLoadGovernor {
  private current: LoadLevel = 0;
  private limitedSince: number | null = null;
  private freeSince: number | null = null;
  private changedAt: number;

  constructor(private readonly now: () => number = Date.now) {
    this.changedAt = now();
  }

  get level(): LoadLevel {
    return this.current;
  }

  /** Feed the encoder's `qualityLimitationReason`. Returns the new level when it changed, else null. */
  sample(reason: string): LoadLevel | null {
    const t = this.now();
    const limited = reason === 'cpu';
    this.limitedSince = limited ? (this.limitedSince ?? t) : null;
    this.freeSince = limited ? null : (this.freeSince ?? t);
    if (t - this.changedAt < LOAD_MIN_GAP_MS) return null;

    if (this.limitedSince !== null && t - this.limitedSince >= LOAD_DOWN_AFTER_MS && this.current < MAX_LOAD_LEVEL) {
      return this.move((this.current + 1) as LoadLevel, t);
    }
    if (this.freeSince !== null && t - this.freeSince >= LOAD_UP_AFTER_MS && this.current > 0) {
      return this.move((this.current - 1) as LoadLevel, t);
    }
    return null;
  }

  /** A new stream starts from full quality. */
  reset(): void {
    this.current = 0;
    this.limitedSince = null;
    this.freeSince = null;
    this.changedAt = this.now();
  }

  private move(level: LoadLevel, t: number): LoadLevel {
    this.current = level;
    this.limitedSince = null;
    this.freeSince = null;
    this.changedAt = t;
    return level;
  }
}
