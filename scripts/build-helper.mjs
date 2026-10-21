// Compiles the C# input helper with the csc.exe that ships with Windows.
// Plain Node, no packages. A missing compiler is a warning, not a failure: the
// host falls back to dropping input (NullInputInjector).
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'apps/host/helper/InputHelper.cs');
const outDir = join(root, 'apps/host/dist/helper');
const output = join(outDir, 'pilotpane-input.exe');

if (process.platform !== 'win32') {
  console.log('skipped input helper: Windows only');
  process.exit(0);
}

const windir = process.env.WINDIR ?? 'C:\\Windows';
const csc = ['Framework64', 'Framework']
  .map((f) => join(windir, 'Microsoft.NET', f, 'v4.0.30319', 'csc.exe'))
  .find((p) => existsSync(p));

if (!csc) {
  console.warn('warning: csc.exe not found, input helper not built (input will be disabled)');
  process.exit(0);
}

await mkdir(outDir, { recursive: true });
const result = spawnSync(csc, ['/nologo', '/target:exe', '/optimize+', `/out:${output}`, source], {
  encoding: 'utf8'
});
if (result.status !== 0) {
  console.error(result.stdout + result.stderr);
  console.error('input helper failed to compile');
  process.exit(1);
}
console.log('built apps/host/dist/helper/pilotpane-input.exe');
