// PostToolUse: format the file Claude just wrote or edited with the repo's own Prettier.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const file = JSON.parse(raw)?.tool_input?.file_path ?? '';
    const bin = process.platform === 'win32' ? 'node_modules/.bin/prettier.cmd' : 'node_modules/.bin/prettier';
    if (
      /\.(ts|cts|js|mjs|json|css|html|md|yml)$/.test(file) &&
      !/node_modules|[\/]private[\/]/.test(file) &&
      existsSync(bin)
    ) {
      spawnSync(bin, ['--write', '--ignore-unknown', file], { stdio: 'ignore', shell: process.platform === 'win32' });
    }
  } catch {
    // Formatting is best effort; never block an edit.
  }
});
