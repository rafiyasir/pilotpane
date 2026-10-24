import type { Logger } from './log.js';
import type { KeepAwake } from './platform/keep-awake.js';

/** Holds the keep-awake block for as long as a paired viewer is present. */
export class AwakeGuard {
  private held = false;

  constructor(
    private readonly keepAwake: KeepAwake,
    private readonly log: Logger
  ) {}

  viewerPaired(): void {
    if (this.held) return;
    this.held = true;
    this.keepAwake.start();
    this.log.info('keeping the display awake');
  }

  viewerGone(): void {
    if (!this.held) return;
    this.held = false;
    this.keepAwake.stop();
    this.log.info('display may sleep again');
  }

  dispose(): void {
    this.viewerGone();
  }
}
