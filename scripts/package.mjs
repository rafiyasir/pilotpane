// Builds a portable Windows folder and zip from the compiled workspace: out/PilotPane-<version>-win-x64.
// Plain Node, no packages: part of the dependency policy in CLAUDE.md. Run `pnpm package` (it builds first).
//
// Layout: the Electron runtime with electron.exe renamed to PilotPane.exe, and the app in resources/app.
// The two workspace packages are copied as real packages under node_modules/@pilotpane, so the
// import.meta.resolve calls in main.ts work the same as in development. No asar: the input helper
// exe must be spawnable and the LAN server reads files from disk.
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'out');

// Files that never belong in a shipped build.
const isDevOnly = (name) =>
  /\.test\.js$/.test(name) || name.endsWith('.map') || name.endsWith('.tsbuildinfo') || /\.d\.c?ts$/.test(name);

const copyBuilt = (from, to) =>
  cp(from, to, {
    recursive: true,
    dereference: true,
    filter: async (src) => (await stat(src)).isDirectory() || !isDevOnly(src)
  });

async function readVersion() {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (typeof pkg.version !== 'string' || pkg.version === '') throw new Error('root package.json has no version');
  return pkg.version;
}

async function stageElectron(stageDir) {
  const electronDist = join(root, 'apps/host/node_modules/electron/dist');
  try {
    await stat(join(electronDist, 'electron.exe'));
  } catch {
    throw new Error('Electron is not installed. Run `pnpm install` first (the electron download must not be skipped).');
  }
  await cp(electronDist, stageDir, { recursive: true, dereference: true });
  await rename(join(stageDir, 'electron.exe'), join(stageDir, 'PilotPane.exe'));
  await rm(join(stageDir, 'resources', 'default_app.asar'), { force: true });
}

async function stageApp(appDir, version) {
  await mkdir(appDir, { recursive: true });
  const manifest = {
    name: 'pilotpane',
    productName: 'PilotPane',
    version,
    private: true,
    license: 'MIT',
    type: 'module',
    main: 'dist/main/main.js'
  };
  await writeFile(join(appDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await copyBuilt(join(root, 'apps/host/dist'), join(appDir, 'dist'));
}

async function stageWorkspacePackages(appDir) {
  const packages = [
    { name: 'protocol', from: 'packages/protocol' },
    { name: 'viewer', from: 'apps/viewer' }
  ];
  for (const pkg of packages) {
    const dest = join(appDir, 'node_modules', '@pilotpane', pkg.name);
    await mkdir(dest, { recursive: true });
    await cp(join(root, pkg.from, 'package.json'), join(dest, 'package.json'));
    await copyBuilt(join(root, pkg.from, 'dist'), join(dest, 'dist'));
  }
}

async function listFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }
  return files;
}

async function verifyStage(stageDir) {
  const appDir = join(stageDir, 'resources', 'app');
  const required = [
    'PilotPane.exe',
    'resources/app/package.json',
    'resources/app/dist/main/main.js',
    'resources/app/dist/main/preload.cjs',
    'resources/app/dist/renderer',
    'resources/app/dist/assets/tray.png',
    'resources/app/dist/assets/icon.ico',
    'resources/app/node_modules/@pilotpane/protocol/package.json',
    'resources/app/node_modules/@pilotpane/protocol/dist/index.js',
    'resources/app/node_modules/@pilotpane/viewer/package.json',
    'resources/app/node_modules/@pilotpane/viewer/dist/index.html'
  ];
  const problems = [];
  for (const rel of required) {
    try {
      await stat(join(stageDir, rel));
    } catch {
      problems.push(`missing ${rel}`);
    }
  }
  for (const file of await listFiles(appDir)) {
    if (isDevOnly(file)) problems.push(`dev-only file in the package: ${relative(stageDir, file)}`);
  }
  if (problems.length > 0) throw new Error(`The staged folder is not complete:\n  ${problems.join('\n  ')}`);

  try {
    await stat(join(appDir, 'dist', 'helper', 'pilotpane-input.exe'));
  } catch {
    console.warn('warning: pilotpane-input.exe is missing, so the package will run without mouse and keyboard input.');
  }
}

function zipStage(stageDir) {
  const zipPath = `${stageDir}.zip`;
  // The tar that ships with Windows 10 and 11 writes zip files with -a. Use it by full path so Git Bash's GNU tar is not picked.
  const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  const result = spawnSync(tar, ['-a', '-c', '-f', zipPath, '-C', dirname(stageDir), stageDir.split(/[\\/]/).pop()], {
    stdio: 'inherit'
  });
  if (result.status !== 0) throw new Error(`tar failed with exit code ${result.status ?? 'none'}`);
  return zipPath;
}

if (process.platform !== 'win32') {
  console.error('pnpm package builds the Windows package and only runs on Windows.');
  process.exit(1);
}

const version = await readVersion();
const stageDir = join(outRoot, `PilotPane-${version}-win-x64`);
const appDir = join(stageDir, 'resources', 'app');

await rm(stageDir, { recursive: true, force: true });
await rm(`${stageDir}.zip`, { force: true });
await stageElectron(stageDir);
await stageApp(appDir, version);
await stageWorkspacePackages(appDir);
await verifyStage(stageDir);
const zipPath = zipStage(stageDir);

console.log(`folder: ${relative(root, stageDir)}`);
console.log(`zip:    ${relative(root, zipPath)}`);
