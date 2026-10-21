import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createLogger } from '../log.js';
import type { HelperProcess } from './helper-input-injector.js';

const log = createLogger('input');

/** Starts the real helper exe. Throws if the process cannot be created. */
export function spawnHelper(exePath: string): HelperProcess {
  const child = spawn(exePath, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  child.stdin.on('error', () => {
    /* the exit handler reports a dead helper */
  });
  createInterface({ input: child.stderr }).on('line', (line) => log.debug(`helper: ${line}`));
  const lines = createInterface({ input: child.stdout });
  return {
    write: (line) => {
      child.stdin.write(`${line}\n`);
    },
    onLine: (cb) => lines.on('line', cb),
    onExit: (cb) => {
      let done = false;
      const once = (): void => {
        if (done) return;
        done = true;
        cb();
      };
      child.once('exit', once);
      child.once('error', once);
    },
    close: () => {
      child.stdin.end();
    }
  };
}
