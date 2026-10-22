import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collect, scanRepo, shouldScan } from './git-source.mjs';
import { isAllowed, mask, parseDiffAdditions, scanText } from './secret-scan.mjs';

// Samples are built from pieces so this file does not trip the scanner itself.
const KEY_BLOCK = '-----BEGIN ' + 'PRIVATE KEY-----';
const GH_TOKEN = 'ghp' + '_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8';
const AWS_KEY = 'AKIA' + 'ABCDEFGHIJKLMNOP';
const SLACK = 'xoxb' + '-123456789012-abcdefghij';
const REAL_IP = ['203', '0', '113', '45'].join('.');
const EMAIL = 'someone' + '@' + 'mail.test';
const USER_PATH = 'C:' + '\\Users\\' + 'jordan\\Desktop';

const rules = (text, options = { path: 'a.txt' }) => scanText(text, options).map((f) => f.rule);

test('each rule finds a positive sample', () => {
  assert.deepEqual(rules(KEY_BLOCK), ['private-key']);
  assert.deepEqual(rules(`x ${GH_TOKEN}`), ['github-token']);
  assert.deepEqual(rules(AWS_KEY), ['aws-key']);
  assert.deepEqual(rules(SLACK), ['slack-token']);
  assert.deepEqual(rules('const password = "hunter2hunter2hunter2"'), ['secret-assignment']);
  assert.deepEqual(rules(`mail ${EMAIL}`), ['email']);
  assert.deepEqual(rules(`host ${REAL_IP}`), ['ipv4']);
  assert.deepEqual(rules(`open ${USER_PATH}`), ['user-path']);
  assert.deepEqual(rules('/home/jordan/project'), ['user-path']);
});

test('documentation examples and placeholders are not findings', () => {
  const clean = [
    'http://192.168.1.12:7420 and 192.168.50.1 and 192.168.137.1 and 127.0.0.1 and 0.0.0.0',
    'not an address: 10.0.0.999',
    'C:\\Users\\<you>\\AppData and %USERPROFILE%\\x and /home/<name>',
    'C:\\Users\\Public\\Desktop',
    'noreply@github.com and a@example.com',
    'token = process.env.TOKEN',
    'const password = "short"'
  ];
  for (const line of clean) assert.deepEqual(rules(line), [], line);
});

test('a line with scan:ignore is skipped', () => {
  assert.deepEqual(rules(`${REAL_IP} // scan:ignore`), []);
});

test('findings carry line numbers and only a masked preview', () => {
  const [f] = scanText(`ok\nok\n${GH_TOKEN}`, { path: 'x.js' });
  assert.equal(f?.line, 3);
  assert.equal(f?.path, 'x.js');
  assert.equal(f?.preview, 'ghp_***');
  assert.ok(!JSON.stringify(f).includes(GH_TOKEN));
  assert.equal(mask('abc'), '***');
});

test('allow entries match on rule, path and value, and an empty entry matches nothing', () => {
  const text = `ip ${REAL_IP}`;
  assert.equal(scanText(text, { path: 'a.txt', allow: [{ rule: 'ipv4', value: REAL_IP }] }).length, 0);
  assert.equal(scanText(text, { path: 'a.txt', allow: [{ rule: 'email' }] }).length, 1);
  assert.equal(scanText(text, { path: 'a.txt', allow: [{ path: 'b.txt' }] }).length, 1);
  assert.equal(isAllowed({ rule: 'ipv4', path: 'a' }, 'v', [{}]), false);
});

test('parseDiffAdditions reads commit, file and new line numbers', () => {
  const diff = [
    'commit abcdef1234567890',
    'diff --git a/f.txt b/f.txt',
    '--- a/f.txt',
    '+++ b/f.txt',
    '@@ -1,0 +5,2 @@',
    '+one',
    '+two',
    '@@ -9 +20 @@',
    '-old',
    '+new'
  ].join('\n');
  assert.deepEqual(parseDiffAdditions(diff), [
    { commit: 'abcdef123456', path: 'f.txt', line: 5, text: 'one' },
    { commit: 'abcdef123456', path: 'f.txt', line: 6, text: 'two' },
    { commit: 'abcdef123456', path: 'f.txt', line: 20, text: 'new' }
  ]);
});

test('shouldScan skips private, lockfiles, binaries and build output', () => {
  for (const p of ['private/notes.md', 'pnpm-lock.yaml', 'a/logo.png', 'dist/x.js', 'apps/host/node_modules/a.js']) {
    assert.equal(shouldScan(p), false, p);
  }
  assert.equal(shouldScan('docs/a.md'), true);
});

test('collect in tracked mode skips big, binary and missing files', () => {
  const files = {
    'a.txt': Buffer.from('hi'),
    'big.txt': Buffer.alloc(1024 * 1024 + 1, 97),
    'bin.dat': Buffer.from([1, 0, 2])
  };
  const io = {
    run: () => 'a.txt\0big.txt\0bin.dat\0gone.txt\0private/x.txt\0',
    readFile: (p) => {
      const f = files[p];
      if (!f) throw new Error('ENOENT');
      return f;
    }
  };
  assert.deepEqual(collect('tracked', io), [{ path: 'a.txt', text: 'hi' }]);
});

test('scanRepo reports history findings with the commit and the line in the new file', () => {
  const diff = ['commit 1234567890abcdef', '+++ b/c.txt', '@@ -0,0 +7 @@', `+ip ${REAL_IP}`].join('\n');
  const io = { run: (args) => (args[0] === 'log' ? diff : ''), readFile: () => Buffer.alloc(0) };
  assert.deepEqual(scanRepo('history', io), [
    { rule: 'ipv4', path: 'c.txt', line: 7, preview: '203.***', commit: '1234567890ab' }
  ]);
});

test('scanRepo staged mode runs git diff --cached', () => {
  let seen = [];
  const io = { run: (args) => ((seen = args), ''), readFile: () => Buffer.alloc(0) };
  assert.deepEqual(scanRepo('staged', io), []);
  assert.deepEqual(seen.slice(0, 2), ['diff', '--cached']);
});
