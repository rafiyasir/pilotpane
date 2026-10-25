// Signs a release and renders the download page. Run it on the maintainer's machine after the release workflow
// has made the draft release (ADR-012). The private key is read from --key and nowhere else.
//
//   pnpm release:sign -- --version 0.2.0 --key private/update-key/update-private.pem --note "What changed"
//
// Options:
//   --version X.Y.Z   the release to sign (required)
//   --key FILE        Ed25519 private key, PEM (required)
//   --note TEXT       a line for the update dialog, up to 3 (repeat the option)
//   --repo OWNER/NAME default rafiyasir/pilotpane
//   --dir FOLDER      use SHA256SUMS, the installer and the zip from this folder instead of downloading them with the GitHub CLI
//   --out-dir FOLDER  where to write update/manifest.json and index.html, default docs
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installerName, signRelease, zipName } from './lib/release-flow.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { notes: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (!arg.startsWith('--')) fail(`unexpected argument: ${arg}`);
    const value = argv[++i];
    if (value === undefined) fail(`${arg} needs a value`);
    if (arg === '--note') out.notes.push(value);
    else out[arg.slice(2)] = value;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
for (const need of ['version', 'key']) if (!args[need]) fail(`missing --${need}`);
if (!/^\d+\.\d+\.\d+$/.test(args.version)) fail('--version must look like 1.2.3');
const repo = args.repo ?? 'rafiyasir/pilotpane';
const outDir = resolve(args['out-dir'] ?? join(root, 'docs'));

let assetDir = args.dir ? resolve(args.dir) : undefined;
let tempDir;
if (!assetDir) {
  tempDir = mkdtempSync(join(tmpdir(), 'pilotpane-release-'));
  assetDir = tempDir;
  console.log(`downloading v${args.version} from ${repo} with the GitHub CLI...`);
  const patterns = ['SHA256SUMS', installerName(args.version), zipName(args.version)].flatMap((p) => ['--pattern', p]);
  const result = spawnSync(
    'gh',
    ['release', 'download', `v${args.version}`, '--repo', repo, '--dir', assetDir, ...patterns],
    {
      stdio: 'inherit'
    }
  );
  if (result.error || result.status !== 0) {
    rmSync(tempDir, { recursive: true, force: true });
    fail(
      'could not download the release. Install the GitHub CLI (https://cli.github.com) and run "gh auth login", or download the three files from the draft release in your browser into a folder and pass --dir <folder>.'
    );
  }
}

try {
  const result = await signRelease({
    version: args.version,
    repo,
    notes: args.notes,
    privateKeyPem: readFileSync(args.key),
    template: readFileSync(join(root, 'docs/site/index.template.html'), 'utf8'),
    readAsset: async (name) => readFileSync(join(assetDir, name)),
    fetchJson: async (url) => {
      const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) throw new Error(`status ${response.status}`);
      return response.json();
    }
  });

  mkdirSync(join(outDir, 'update'), { recursive: true });
  writeFileSync(join(outDir, 'update/manifest.json'), result.manifestText);
  writeFileSync(join(outDir, 'index.html'), result.pageHtml);
  if (outDir !== join(root, 'docs')) {
    // A test folder needs the page's stylesheet and script beside it.
    mkdirSync(join(outDir, 'site'), { recursive: true });
    for (const file of ['site.css', 'site.js']) cpSync(join(root, 'docs/site', file), join(outDir, 'site', file));
  }
  console.log(
    `signed v${args.version}: sha256 ${result.manifest.sha256.slice(0, 12)}..., ${result.downloads} downloads so far`
  );
  console.log(`wrote ${join(outDir, 'update/manifest.json')}`);
  console.log(`wrote ${join(outDir, 'index.html')}`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}
