// Looks for secrets and personal data before a push or a release (spec 028).
//
//   node scripts/scan-secrets.mjs             tracked files in the working tree
//   node scripts/scan-secrets.mjs --staged    added lines of staged changes
//   node scripts/scan-secrets.mjs --history   added lines of every commit on every branch
//
// Exit code 0 = clean, 1 = findings, 2 = could not scan. Findings show a masked preview only.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRepo } from './lib/git-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => a !== '--');
const mode = args.includes('--history') ? 'history' : args.includes('--staged') ? 'staged' : 'tracked';

const io = {
  run: (gitArgs) => execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 }),
  readFile: (path) => readFileSync(join(root, path))
};

try {
  const allow = JSON.parse(readFileSync(join(root, 'scripts', 'secret-scan.allow.json'), 'utf8'));
  const findings = scanRepo(mode, io, allow);
  for (const f of findings) {
    console.log(`${f.commit ? `${f.commit} ` : ''}${f.path}:${f.line}  ${f.rule}  ${f.preview}`);
  }
  if (findings.length > 0) {
    console.error(
      `\n${findings.length} finding(s) in ${mode} mode. Remove them, or add a reviewed entry to scripts/secret-scan.allow.json.`
    );
    process.exit(1);
  }
  console.log(`No findings (${mode}).`);
} catch (error) {
  console.error(`Scan failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
