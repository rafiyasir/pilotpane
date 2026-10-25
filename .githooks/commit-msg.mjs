// commit-msg: Conventional Commits subject, and no AI attribution lines. Plain Node, no packages.
import { readFileSync } from 'node:fs';

const message = readFileSync(process.argv[2] ?? '', 'utf8');
const subject = message.split('\n')[0] ?? '';
const problems = [];

// Merge, revert and fixup commits made by git itself are left alone.
if (!/^(Merge |Revert |fixup! |squash! )/.test(subject)) {
  if (!/^(feat|fix|docs|test|chore|refactor|perf|build|ci|style)(\([a-z0-9-]+\))?!?: \S/.test(subject)) {
    problems.push('Subject must look like "type(scope): description", e.g. "feat(host): add tray menu".');
  }
  if (subject.length > 72) problems.push(`Subject is ${subject.length} characters; keep it under 72.`);
}
if (/^\s*co-authored-by:/im.test(message)) problems.push('Remove the Co-Authored-By line.');
if (/generated with/i.test(message)) problems.push('Remove the "Generated with" line.');

if (problems.length > 0) {
  process.stderr.write(`commit-msg: rejected\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}
