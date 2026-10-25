import { createLogger } from '../log.js';
import { formatCommand, type InputCommand } from './input-command.js';
import type { InputInjector } from './input-injector.js';

const log = createLogger('input');

/** The helper process as the injector sees it, so tests can fake it. */
export interface HelperProcess {
  write(line: string): void;
  /** Called for each line the helper prints on stdout. */
  onLine(cb: (line: string) => void): void;
  /** Called once when the process ends, for any reason. */
  onExit(cb: () => void): void;
  /** Closes stdin so the helper releases held input and exits. */
  close(): void;
}

export interface HelperInputInjectorOptions {
  spawn: () => HelperProcess;
}

const MAX_RESTARTS = 1;

/** Sends input commands to the C# SendInput helper over its stdin. Never throws into the host. */
export class HelperInputInjector implements InputInjector {
  private proc: HelperProcess | null = null;
  private ready = false;
  private restarts = 0;
  private disposed = false;
  private warnedDown = false;
  private readonly heldButtons = new Set<'left' | 'right' | 'middle'>();
  private readonly heldKeys = new Set<number>();

  constructor(private readonly opts: HelperInputInjectorOptions) {
    this.launch();
  }

  get available(): boolean {
    return !this.disposed && this.proc !== null;
  }

  inject(cmd: InputCommand): void {
    const line = formatCommand(cmd);
    if (line === null) {
      log.debug('dropped an invalid input command');
      return;
    }
    if (!this.proc || !this.ready) {
      if (!this.warnedDown) {
        this.warnedDown = true;
        log.warn('input helper is not running, dropping input');
      }
      return;
    }
    this.track(cmd);
    this.send(line);
  }

  releaseAll(): void {
    if (this.proc && this.ready) this.releaseHeld();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.proc && this.ready) this.releaseHeld();
    this.proc?.close();
    this.proc = null;
    this.ready = false;
  }

  private launch(): void {
    let proc: HelperProcess;
    try {
      proc = this.opts.spawn();
    } catch (err) {
      log.warn('could not start the input helper', err);
      return;
    }
    this.proc = proc;
    this.ready = false;
    proc.onLine((line) => {
      if (this.proc !== proc || line.trim() !== 'ready') return;
      this.ready = true;
      this.warnedDown = false;
      this.releaseHeld(); // input a previous helper process left pressed
      log.debug('input helper ready');
    });
    proc.onExit(() => {
      if (this.proc !== proc) return;
      this.proc = null;
      this.ready = false;
      if (this.disposed) return;
      if (this.restarts < MAX_RESTARTS) {
        this.restarts += 1;
        log.warn('input helper stopped, restarting once');
        this.launch();
      } else {
        log.warn('input helper stopped again, input is off until the host restarts');
      }
    });
  }

  private track(cmd: InputCommand): void {
    if (cmd.kind === 'button') {
      if (cmd.down) this.heldButtons.add(cmd.button);
      else this.heldButtons.delete(cmd.button);
    } else if (cmd.kind === 'key') {
      if (cmd.down) this.heldKeys.add(cmd.vk);
      else this.heldKeys.delete(cmd.vk);
    }
  }

  private releaseHeld(): void {
    for (const button of this.heldButtons) {
      const line = formatCommand({ kind: 'button', button, down: false });
      if (line) this.send(line);
    }
    for (const vk of this.heldKeys) {
      const line = formatCommand({ kind: 'key', vk, down: false });
      if (line) this.send(line);
    }
    this.heldButtons.clear();
    this.heldKeys.clear();
  }

  private send(line: string): void {
    try {
      this.proc?.write(line);
    } catch (err) {
      log.warn('could not write to the input helper', err);
    }
  }
}
