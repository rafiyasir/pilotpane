// Manual check for the input helper: traces a square with the cursor, presses the
// middle button once and scrolls once. Run `pnpm build` first.
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HelperInputInjector } from '../apps/host/dist/main/platform/helper-input-injector.js';
import { spawnHelper } from '../apps/host/dist/main/platform/spawn-helper.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = join(root, 'apps/host/dist/helper/pilotpane-input.exe');

const injector = new HelperInputInjector({ spawn: () => spawnHelper(exe) });
await sleep(500); // let the helper print "ready"

const corners = [
  [16384, 16384],
  [49152, 16384],
  [49152, 49152],
  [16384, 49152],
  [16384, 16384]
];
for (const [x, y] of corners) {
  console.log(`move ${x} ${y}`);
  for (let i = 0; i < 10; i++) {
    injector.inject({ kind: 'move', x, y });
    await sleep(20);
  }
  await sleep(400);
}
injector.inject({ kind: 'button', button: 'middle', down: true });
injector.inject({ kind: 'button', button: 'middle', down: false });
injector.inject({ kind: 'wheel', dx: 0, dy: -1 });
await sleep(300);
injector.dispose();
console.log('done');
