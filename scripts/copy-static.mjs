// Copies non-TypeScript files (HTML, CSS, images) next to the compiled output.
// Plain Node, no packages: part of the dependency policy in CLAUDE.md.
import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = new Set(['.html', '.css', '.png', '.ico', '.svg']);

const jobs = [
  { from: 'apps/viewer/src', to: 'apps/viewer/dist' },
  { from: 'apps/host/src/renderer', to: 'apps/host/dist/renderer' },
  { from: 'apps/host/assets', to: 'apps/host/dist/assets' }
];

async function copyStatic(fromDir, toDir) {
  let count = 0;
  for (const entry of await readdir(fromDir, { withFileTypes: true })) {
    const src = join(fromDir, entry.name);
    const dest = join(toDir, entry.name);
    if (entry.isDirectory()) {
      count += await copyStatic(src, dest);
    } else if (STATIC.has(extname(entry.name).toLowerCase())) {
      await mkdir(dirname(dest), { recursive: true });
      await cp(src, dest);
      count += 1;
    }
  }
  return count;
}

for (const job of jobs) {
  const n = await copyStatic(join(root, job.from), join(root, job.to));
  console.log(`copied ${n} static file(s): ${job.from} -> ${relative(root, join(root, job.to))}`);
}
