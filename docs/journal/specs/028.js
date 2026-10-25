window.JOURNAL.push({
  number: '028',
  title: 'Secret scan',
  version: 'dist',
  mergedDate: '2026-10-22',
  technologies: ['Node child_process', 'Regular expressions', 'git log -p', 'Unified diff format', 'Node test runner'],
  oneLine:
    'One command, `pnpm scan`, checks the files and the whole git history for keys, tokens, real IP addresses, emails and personal folder paths before the repo goes public.',

  what: {
    summary:
      'The repo is meant to become public, and anything committed once stays in history forever. Instead of installing a scanner tool, this spec adds a small script written in the repo. It reads either the tracked files, the staged changes or every line ever added in any commit, and reports anything that looks like a secret or personal data. It prints only a masked preview (the first four characters), so its output is safe to paste anywhere.',
    partsTouched: [
      {
        path: 'scripts/lib/secret-scan.mjs',
        note: 'The rules, masking, the allowlist check and a reader for git diffs. No file or git access, so it is easy to test',
        changed: true
      },
      {
        path: 'scripts/lib/git-source.mjs',
        note: 'Decides what to scan (tracked files, staged diff or history) and skips private, binary, huge and lock files',
        changed: true
      },
      {
        path: 'scripts/scan-secrets.mjs',
        note: 'The command: runs git, prints findings, sets the exit code',
        changed: true
      },
      {
        path: 'scripts/secret-scan.allow.json',
        note: 'Reviewed exceptions, such as example IP addresses in test files',
        changed: true
      },
      {
        path: 'docs and .claude/commands',
        note: 'PUBLIC_PRIVATE.md, the CLAUDE.md self-check, /prepare-pr and /release now use `pnpm scan`',
        changed: true
      },
      { path: 'apps and packages', note: 'Untouched: this is repo tooling only', changed: false }
    ]
  },

  why: {
    decisions: [
      {
        chose: 'Write the scanner in the repo with plain Node',
        insteadOf: 'Installing gitleaks or another scanning tool',
        reason:
          'The dependency policy (ADR-002) keeps unknown tools out, and the rule set needed here is small. It also checks things a generic tool does not know about, like this project’s example IP addresses and Windows user paths.'
      },
      {
        chose: 'Report a masked preview and never the matched text',
        insteadOf: 'Printing the full line that matched',
        reason:
          'A scan log that contains the secret is a new place for the secret to leak. Four characters are enough to find the line, and the file and line number are printed as well.'
      },
      {
        chose: 'Flag every IP address except a short list of documentation examples, and use a reviewed allowlist for the rest',
        insteadOf: 'Ignoring all private ranges like 192.168.x.x',
        reason:
          'A real home address is also a private-range address, and that is exactly what the project rules say must not be committed. A few false alarms in test files are cheaper than a missed leak.'
      },
      {
        chose: 'Scan only added lines when checking history',
        insteadOf: 'Scanning every full file in every commit',
        reason:
          'A secret enters history on the line that adds it. Reading `git log -p` additions finds it once, with the commit id, and is far faster.'
      }
    ]
  },

  when: {
    dependsOn: [{ spec: '027', note: 'the release pipeline and the going-public checklist this scan belongs to' }],
    unlocks: [
      { spec: '011', note: 'safe to make the repo public before more features land' }
    ]
  },

  how: {
    steps: [
      {
        title: 'Collect what to look at',
        explanation:
          'In the default mode git lists the tracked files and the script reads them. With `--staged` it asks git for the staged diff. With `--history` it asks for `git log -p` across all branches. In the two diff modes only added lines are kept.'
      },
      {
        title: 'Filter out noise',
        explanation:
          'Folders like `private/`, build output, lock files, images and other binaries, files over 1 MB and files containing a zero byte are skipped before any rule runs.'
      },
      {
        title: 'Run the rules line by line',
        explanation:
          'Each rule is a regular expression, sometimes with an `ignore` function for allowed cases such as `127.0.0.1` or `C:\\Users\\<you>`. A line containing `scan:ignore` is skipped.'
      },
      {
        title: 'Mask and filter by the allowlist',
        explanation:
          'A match becomes a finding with the rule name, path, line and a masked preview. An allowlist entry removes it when every field the entry names matches.'
      },
      {
        title: 'Report and set the exit code',
        explanation:
          'Findings are printed as `path:line  rule  preview` (with the commit id for history). Exit code 0 means clean, 1 means findings, 2 means the scan itself failed.'
      }
    ]
  },

  code: [
    {
      file: 'scripts/lib/secret-scan.mjs',
      excerpt: `export function mask(value) {
  return value.length <= 4 ? '***' : \`\${value.slice(0, 4)}***\`;
}

export function scanText(text, { path, allow = [], lineOffset = 0 }) {
  const findings = [];
  const lines = text.split(/\\r?\\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.includes('scan:ignore')) continue;
    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(line)) !== null) {
        if (match[0] === '') rule.regex.lastIndex++;
        if (rule.ignore?.(match)) continue;
        const value = match[1] ?? match[0];
        const finding = { rule: rule.id, path, line: i + 1 + lineOffset, preview: mask(value) };
        if (!isAllowed(finding, value, allow)) findings.push(finding);
      }
    }
  }
  return findings;
}`,
      explanation:
        'The core loop. The finding object is built from the rule, path, line and a masked preview, and the matched text itself is never stored in it. `lineOffset` lets the same function report the right line number for a single added line from a diff.'
    },
    {
      file: 'scripts/lib/secret-scan.mjs',
      excerpt: `export function parseDiffAdditions(diff) {
  const out = [];
  let path = '';
  let line = 0;
  let commit = '';
  for (const raw of diff.split(/\\r?\\n/)) {
    if (raw.startsWith('commit ')) commit = raw.slice(7, 19);
    else if (raw.startsWith('+++ ')) path = raw.startsWith('+++ b/') ? raw.slice(6) : '';
    else if (raw.startsWith('@@')) {
      const m = /\\+(\\d+)/.exec(raw);
      line = m ? Number(m[1]) : 0;
    } else if (raw.startsWith('+') && path) out.push({ commit, path, line: line++, text: raw.slice(1) });
    else if (raw.startsWith(' ')) line++;
  }
  return out;
}`,
      explanation:
        'Reads the output of `git log -p`. The `@@ -a,b +c,d @@` header tells where the new lines start, so every added line gets its real line number in the file and the id of the commit that added it.'
    },
    {
      file: 'scripts/lib/secret-scan.mjs',
      excerpt: `export function isAllowed(finding, value, allow) {
  return allow.some(
    (a) =>
      (a.rule === undefined || a.rule === finding.rule) &&
      (a.path === undefined || a.path === finding.path) &&
      (a.value === undefined || a.value === value) &&
      (a.rule !== undefined || a.path !== undefined || a.value !== undefined)
  );
}`,
      explanation:
        'An allowlist entry matches when every field it names matches. The last line makes an empty entry `{}` match nothing, so a typo cannot switch the whole scanner off.'
    }
  ],

  concepts: [
    {
      name: 'Regular expressions',
      level: 'Core',
      explanation:
        'Each rule is a pattern. The IPv4 rule uses a lookbehind and lookahead so that `1.2.3.4.5` or a version like `10.0.0.1.2` is not matched as an address. The `g` flag plus `lastIndex` lets one line hold several matches.',
      resources: [
        {
          title: 'MDN: Regular expressions',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions'
        },
        {
          title: 'MDN: RegExp.prototype.exec()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec'
        }
      ]
    },
    {
      name: 'Git history is permanent',
      level: 'Core',
      explanation:
        'A deleted file or line still exists in older commits, so a secret removed later is still public once the repo is. That is why the scan reads added lines in every commit, not only the current files. Commit author and committer emails are stored in the commit itself and this scan does not read them, so they are checked with `git log --format=%ae`.',
      resources: [
        { title: 'Git docs: git log', url: 'https://git-scm.com/docs/git-log' },
        { title: 'Git docs: pretty formats', url: 'https://git-scm.com/docs/pretty-formats' }
      ]
    },
    {
      name: 'Unified diff format',
      level: 'Concept',
      explanation:
        'A diff lists changed files with `+++` and `---` lines, then hunks that start with `@@ -old +new @@`. Lines starting with `+` were added, `-` removed, and a space is unchanged. Counting those lines gives exact line numbers.',
      resources: [{ title: 'Git docs: git diff, generating patch text', url: 'https://git-scm.com/docs/git-diff' }]
    },
    {
      name: 'Dependency injection for tests',
      level: 'Pattern',
      explanation:
        'The git source gets `run` and `readFile` passed in. Tests give it fakes, so no real repo or disk is needed, and the same code runs for real with `execFileSync` and `readFileSync`.',
      resources: [
        {
          title: 'Node.js docs: child_process.execFileSync',
          url: 'https://nodejs.org/api/child_process.html#child_processexecfilesyncfile-args-options'
        },
        { title: 'Node.js docs: test runner', url: 'https://nodejs.org/api/test.html' }
      ]
    }
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why does a finding show only `ghp_***` and not the whole token?',
      answer:
        'A scan log with the full token would be another place for it to leak, for example in a pasted terminal. The file and line number are enough to find it.'
    },
    {
      question: 'A password was committed and deleted two commits later. Does `pnpm scan` (default mode) find it? What does?',
      answer:
        'The default mode scans current files only, so no. `pnpm scan -- --history` reads every added line in every commit and finds it. The password should also be treated as leaked and changed.'
    },
    {
      question: 'Why are `192.168.1.12` and `127.0.0.1` allowed but `203.0.113.45` is a finding?',
      answer:
        'The first two are documentation examples and local loopback. Any other address could be a real one, and real addresses must not be committed, so the scan stays strict and uses a reviewed allowlist for the rest.'
    },
    {
      question: 'Why can the scan not find the Gmail address in the commit authors?',
      answer:
        'Author emails are commit metadata, not file content. The scan reads file lines, so they are checked separately with `git log --format=%ae | sort -u`.'
    }
  ],

  commits: [],
  commitsNote:
    'The commits for this spec are listed after the PR is prepared. The spec’s work was done on the branch `spec/028-secret-scan`.'
});
