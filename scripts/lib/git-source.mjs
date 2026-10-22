// What `pnpm scan` looks at. All git and file access goes through the injected `run` and `readFile`.
import { parseDiffAdditions, scanText } from './secret-scan.mjs';

const SKIP_DIRS = ['private/', 'node_modules/', 'dist/', 'out/'];
const SKIP_NAMES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|exe|dll|zip|gz|7z|pdf|woff2?|ttf|otf|mp4|webm|mp3|wav|bin|pfx|snk)$/i;
export const MAX_BYTES = 1024 * 1024;

export function shouldScan(path) {
  const p = path.replace(/\\/g, '/');
  if (SKIP_DIRS.some((d) => p.startsWith(d) || p.includes(`/${d}`))) return false;
  const name = p.slice(p.lastIndexOf('/') + 1);
  return !SKIP_NAMES.includes(name) && !BINARY_EXT.test(name);
}

/**
 * @param {{ run: (args: string[]) => string, readFile: (path: string) => Buffer }} io
 * @returns {{ path: string, text: string, commit?: string, line?: number }[]} chunks to scan; `line` is set for single added lines
 */
export function collect(mode, { run, readFile }) {
  if (mode === 'tracked') {
    const paths = run(['ls-files', '-z']).split('\0').filter(Boolean);
    const chunks = [];
    for (const path of paths) {
      if (!shouldScan(path)) continue;
      let buf;
      try {
        buf = readFile(path);
      } catch {
        continue; // listed but deleted in the working tree
      }
      if (buf.length > MAX_BYTES || buf.includes(0)) continue;
      chunks.push({ path, text: buf.toString('utf8') });
    }
    return chunks;
  }
  const diff =
    mode === 'staged'
      ? run(['diff', '--cached', '-U0', '--no-color'])
      : run(['log', '-p', '--all', '-U0', '--no-color', '--no-ext-diff']);
  return parseDiffAdditions(diff)
    .filter((a) => shouldScan(a.path) && a.text.length <= MAX_BYTES)
    .map((a) => ({ path: a.path, text: a.text, commit: a.commit || undefined, line: a.line }));
}

/** Collects the chunks for a mode and returns every finding, with the commit id when scanning history. */
export function scanRepo(mode, io, allow = []) {
  const findings = [];
  for (const chunk of collect(mode, io)) {
    const lineOffset = chunk.line === undefined ? 0 : chunk.line - 1;
    for (const f of scanText(chunk.text, { path: chunk.path, allow, lineOffset })) {
      findings.push(chunk.commit ? { ...f, commit: chunk.commit } : f);
    }
  }
  return findings;
}
