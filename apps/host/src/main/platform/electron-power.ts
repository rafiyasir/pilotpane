import { powerMonitor } from 'electron';
import type { PowerEvents } from './power.js';

export class ElectronPowerEvents implements PowerEvents {
  onSuspend(cb: () => void): void {
    powerMonitor.on('suspend', cb);
  }

  onResume(cb: () => void): void {
    powerMonitor.on('resume', cb);
  }
}
