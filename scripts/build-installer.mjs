// Builds out/PilotPane-Setup-<version>.exe: a small C# setup program with the portable zip embedded.
// Plain Node, no packages. Uses the csc.exe that ships with Windows (see ADR-003 and ADR-010).
// Run `pnpm installer`; it repackages first so the installer never embeds a stale build.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCsc } from './lib/csc.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'out');

if (process.platform !== 'win32') {
  console.error('pnpm installer builds the Windows installer and only runs on Windows.');
  process.exit(1);
}

const csc = findCsc();
if (!csc) {
  console.error('csc.exe (the .NET Framework compiler that ships with Windows) was not found.');
  process.exit(1);
}

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
if (typeof version !== 'string' || version === '') throw new Error('root package.json has no version');

const packaged = spawnSync(process.execPath, [join(root, 'scripts/package.mjs')], { stdio: 'inherit' });
if (packaged.status !== 0) process.exit(packaged.status ?? 1);

const zip = join(outRoot, `PilotPane-${version}-win-x64.zip`);
if (!existsSync(zip)) throw new Error(`missing ${relative(root, zip)}`);

const versionFile = join(outRoot, 'installer-version.txt');
await writeFile(versionFile, `${version}\n`);

const source = join(root, 'apps/installer/Setup.cs');
const references = [
  '/reference:System.Windows.Forms.dll',
  '/reference:System.IO.Compression.dll',
  '/reference:System.IO.Compression.FileSystem.dll'
];
const icon = `/win32icon:${join(root, 'apps/host/assets/icon.ico')}`;

function compile(out, resources) {
  const result = spawnSync(
    csc,
    ['/nologo', '/target:winexe', '/optimize+', `/out:${out}`, icon, ...references, ...resources, source],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) {
    console.error(result.stdout + result.stderr);
    console.error('installer failed to compile');
    process.exit(1);
  }
}

// The uninstaller is the same source without the payload, embedded in the setup.
const uninstaller = join(outRoot, 'installer-uninstall.exe');
const output = join(outRoot, `PilotPane-Setup-${version}.exe`);
try {
  compile(uninstaller, []);
  compile(output, [
    `/resource:${zip},payload.zip`,
    `/resource:${versionFile},version.txt`,
    `/resource:${uninstaller},uninstall.exe`
  ]);
} finally {
  await unlink(versionFile);
  await rm(uninstaller, { force: true });
}

const size = (await stat(output)).size;
console.log(`installer: ${relative(root, output)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
