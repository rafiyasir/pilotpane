import { createLogger } from '../log.js';

const log = createLogger('input');

/** Puts viewer mouse and keyboard events on the host. Spec 010 adds the real one. */
export interface InputInjector {
  /** The event type is narrowed to the real input event in spec 011. */
  inject(event: unknown): void;
  dispose(): void;
}

/** Used until input injection exists: drops every event. */
export class NullInputInjector implements InputInjector {
  private warned = false;

  inject(_event: unknown): void {
    if (this.warned) return;
    this.warned = true;
    log.debug('input injection is not available yet, dropping events');
  }

  dispose(): void {
    /* nothing to release */
  }
}
