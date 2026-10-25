/** No bytes at all on the media link for this long means it is dead. */
export const LINK_DEAD_AFTER_MS = 8_000;

/**
 * Tells a quiet link from a dead one. Feed it the total bytes the transport has
 * received (video, RTCP and ICE keep-alives all count), not video frames: a
 * still desktop sends almost no video but the transport is never silent.
 */
export class LinkWatch {
  private bytes: number | null = null;
  private movedAt = 0;

  constructor(private readonly deadAfterMs: number = LINK_DEAD_AFTER_MS) {}

  /** Returns true when the link has gone dead. */
  sample(now: number, totalBytes: number): boolean {
    if (this.bytes === null || totalBytes !== this.bytes) {
      this.bytes = totalBytes;
      this.movedAt = now;
      return false;
    }
    return now - this.movedAt >= this.deadAfterMs;
  }

  /** Forget everything, for a fresh connection. */
  reset(): void {
    this.bytes = null;
  }
}
