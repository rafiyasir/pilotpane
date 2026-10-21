// PreToolUse (Bash): block risky git/gh commands and destructive commands on protected paths.
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let cmd = '';
  try {
    cmd = JSON.parse(raw)?.tool_input?.command ?? '';
  } catch {
    process.exit(0);
  }
  const block = (msg) => {
    process.stderr.write(`BLOCKED: ${msg}\n`);
    process.exit(2);
  };
  const protectedPaths = ['.claude/specs/', 'docs/', 'apps/host/assets/'];
  const destructive = /\b(rm|unlink|truncate|del|rmdir|rd|Remove-Item)\b/i;
  if (destructive.test(cmd) && protectedPaths.some((p) => cmd.includes(p))) {
    block('destructive command on a protected path');
  }
  if (
    /git\s+push\b/.test(cmd) &&
    !/--delete/.test(cmd) &&
    /(^|[\s:])(main|dev)\b/.test(cmd.replace(/^.*git\s+push/, ''))
  ) {
    block('never push to main or dev; push a work branch and open a PR');
  }
  if (/git\s+push\b.*(--force|--force-with-lease|\s-f\b)/.test(cmd)) block('force push is not allowed');
  if (/gh\s+pr\s+(create|merge)/.test(cmd)) block('PRs are created and merged by the maintainer');
  const slashed = cmd.split(String.fromCharCode(92)).join('/');
  const withoutMessage = slashed.replace(/-m\s+("[^"]*"|'[^']*')/g, '');
  if (/git\s+(add|commit)\b/.test(withoutMessage) && /(^|[\s'"/])private(\/|[\s'"]|$)/.test(withoutMessage)) {
    block('private/ must never be added or committed');
  }
  if (/git\s+add\s+(-A|--all|\.)(\s|$)/.test(cmd)) block('add explicit paths, never "git add ." or -A');
  process.exit(0);
});
