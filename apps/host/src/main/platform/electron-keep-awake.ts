import { powerSaveBlocker } from 'electron';
import type { KeepAwake } from './keep-awake.js';

export class ElectronKeepAwake implements KeepAwake {
  private blocker: number | null = null;

  start(): void {
    if (this.blocker === null) this.blocker = powerSaveBlocker.start('prevent-display-sleep');
  }

  stop(): void {
    if (this.blocker !== null) {
      powerSaveBlocker.stop(this.blocker);
      this.blocker = null;
    }
  }
}
