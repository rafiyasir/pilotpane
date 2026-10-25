// Removes build output so the next build starts fresh.
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['packages/protocol/dist', 'apps/viewer/dist', 'apps/host/dist', 'out'];

for (const t of targets) {
  await rm(join(root, t), { recursive: true, force: true });
  console.log(`removed ${t}`);
}
