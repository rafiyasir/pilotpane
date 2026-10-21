import { createLogger } from '../log.js';
import type { InputCommand } from './input-command.js';

const log = createLogger('input');

/** Puts mouse and keyboard input on the host. HelperInputInjector is the real one. */
export interface InputInjector {
  inject(cmd: InputCommand): void;
  dispose(): void;
}

/** Used when the helper is not available: drops every command. */
export class NullInputInjector implements InputInjector {
  private warned = false;

  inject(_cmd: InputCommand): void {
    if (this.warned) return;
    this.warned = true;
    log.debug('input injection is not available, dropping commands');
  }

  dispose(): void {
    /* nothing to release */
  }
}
