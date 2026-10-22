// Compiles the C# input helper with the csc.exe that ships with Windows.
// Plain Node, no packages. A missing compiler is a warning, not a failure: the
// host falls back to dropping input (NullInputInjector).
import { existsSync } from 'node:fs';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCsc } from './lib/csc.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'apps/host/helper/InputHelper.cs');
const outDir = join(root, 'apps/host/dist/helper');
const output = join(outDir, 'pilotpane-input.exe');
const temp = join(outDir, 'pilotpane-input.build.exe');

if (process.platform !== 'win32') {
  console.log('skipped input helper: Windows only');
  process.exit(0);
}

const csc = findCsc();

if (!csc) {
  console.warn('warning: csc.exe not found, input helper not built (input will be disabled)');
  process.exit(0);
}

await mkdir(outDir, { recursive: true });
// Compile to a temporary file first: a running host keeps the real exe locked, and
// that must not fail the whole build.
const result = spawnSync(csc, ['/nologo', '/target:exe', '/optimize+', `/out:${temp}`, source], {
  encoding: 'utf8'
});
if (result.status !== 0) {
  console.error(result.stdout + result.stderr);
  console.error('input helper failed to compile');
  await rm(temp, { force: true });
  process.exit(1);
}

try {
  await copyFile(temp, output);
  console.log('built apps/host/dist/helper/pilotpane-input.exe');
} catch (err) {
  if (!existsSync(output)) throw err;
  console.warn('warning: input helper is in use (PilotPane is running), kept the existing build');
  console.warn('quit PilotPane and run pnpm build to update it');
} finally {
  await rm(temp, { force: true });
}
