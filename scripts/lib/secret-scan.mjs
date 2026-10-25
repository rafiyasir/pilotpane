// Secret and personal-data rules for `pnpm scan`. Pure: text in, findings out, no file or git access.
//
// A finding never carries the matched text, only a masked preview, so scan output is safe to paste.

const DOC_IPV4 = [
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
  /^192\.168\.1\.12$/,
  /^192\.168\.50\.\d{1,3}$/,
  /^192\.168\.60\.\d{1,3}$/,
  /^192\.168\.137\.1$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /^255\.255\.\d{1,3}\.\d{1,3}$/
];

const PLACEHOLDER_USER = /^(<[^>]*>|you|me|user|username|name|%[^%]*%|\$\{?[A-Za-z_]+\}?|\*|x+)$/i;

function isDocIpv4(value) {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => p > 255)) return true; // not an address (a version number, say)
  return DOC_IPV4.some((re) => re.test(value));
}

/** @type {{ id: string, description: string, regex: RegExp, ignore?: (match: RegExpExecArray) => boolean }[]} */
export const RULES = [
  {
    id: 'private-key',
    description: 'private key block',
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g
  },
  {
    id: 'github-token',
    description: 'GitHub token',
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g
  },
  {
    id: 'aws-key',
    description: 'AWS access key id',
    regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g
  },
  {
    id: 'slack-token',
    description: 'Slack token',
    regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g
  },
  {
    id: 'secret-assignment',
    description: 'secret-looking value assigned to a token, secret, password or key',
    regex: /\b(?:token|secret|password|passwd|api[_-]?key)\b["']?\s*[:=]\s*["']([A-Za-z0-9+/_\-.=]{16,})["']/gi
  },
  {
    id: 'email',
    description: 'email address',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g,
    ignore: (m) => /^(?:noreply|no-reply)@|@users\.noreply\.github\.com$|@example\.(?:com|org|net)$/i.test(m[0])
  },
  {
    id: 'ipv4',
    description: 'IPv4 address that is not a documentation example',
    regex: /(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.]*\d)/g,
    ignore: (m) => isDocIpv4(m[0])
  },
  {
    id: 'user-path',
    description: 'path under a real user profile',
    regex: /(?:[A-Za-z]:[\\/]+Users[\\/]+|\/Users\/|\/home\/)([^\\/\s"'`<>:*]+)/g,
    ignore: (m) => PLACEHOLDER_USER.test(m[1] ?? '') || /^(?:Public|Default|All Users)$/i.test(m[1] ?? '')
  }
];

/** First four characters then `***`, so a finding never repeats the whole secret. */
export function mask(value) {
  return value.length <= 4 ? '***' : `${value.slice(0, 4)}***`;
}

/**
 * @param {string} text
 * @param {{ path: string, allow?: { rule?: string, path?: string, value?: string }[], lineOffset?: number }} options
 * @returns {{ rule: string, path: string, line: number, preview: string }[]}
 */
export function scanText(text, { path, allow = [], lineOffset = 0 }) {
  const findings = [];
  const lines = text.split(/\r?\n/);
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
}

/** An allow entry matches when every field it names matches: `rule`, `path` (exact) and `value` (exact matched text). */
export function isAllowed(finding, value, allow) {
  return allow.some(
    (a) =>
      (a.rule === undefined || a.rule === finding.rule) &&
      (a.path === undefined || a.path === finding.path) &&
      (a.value === undefined || a.value === value) &&
      (a.rule !== undefined || a.path !== undefined || a.value !== undefined)
  );
}

/** Added lines of a unified diff, with the file and the line number in the new file. */
export function parseDiffAdditions(diff) {
  const out = [];
  let path = '';
  let line = 0;
  let commit = '';
  for (const raw of diff.split(/\r?\n/)) {
    if (raw.startsWith('commit ')) commit = raw.slice(7, 19);
    else if (raw.startsWith('+++ ')) path = raw.startsWith('+++ b/') ? raw.slice(6) : '';
    else if (raw.startsWith('@@')) {
      const m = /\+(\d+)/.exec(raw);
      line = m ? Number(m[1]) : 0;
    } else if (raw.startsWith('+') && path) out.push({ commit, path, line: line++, text: raw.slice(1) });
    else if (raw.startsWith(' ')) line++;
  }
  return out;
}
