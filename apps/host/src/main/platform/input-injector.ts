import { createLogger } from '../log.js';
import type { InputCommand } from './input-command.js';

const log = createLogger('input');

/** Puts mouse and keyboard input on the host. HelperInputInjector is the real one. */
export interface InputInjector {
  /** False when commands would be dropped (no helper), so the viewer can say so. */
  readonly available: boolean;
  inject(cmd: InputCommand): void;
  /** Lets go of every button and key still held down. */
  releaseAll(): void;
  dispose(): void;
}

/** Used when the helper is not available: drops every command. */
export class NullInputInjector implements InputInjector {
  readonly available = false;
  private warned = false;

  inject(_cmd: InputCommand): void {
    if (this.warned) return;
    this.warned = true;
    log.debug('input injection is not available, dropping commands');
  }

  releaseAll(): void {
    /* nothing is held */
  }

  dispose(): void {
    /* nothing to release */
  }
}
