window.JOURNAL.push({
  number: '002',
  title: 'Typed protocol',
  version: 'v0.1',
  mergedDate: '2026-10-21',
  technologies: ['TypeScript', 'SHA-256', 'Secure contexts', 'Node test runner'],
  oneLine:
    'Host and viewer now share one set of typed messages, one validator and one hand-written SHA-256, and the same code runs in Node and in Chrome 109.',

  what: {
    summary:
      'A package with the message types, the only parser for network JSON, a SHA-256 written by hand and the PIN proof. Nine tests check known vectors, parity with `node:crypto` and valid and invalid messages.',
    partsTouched: [
      {
        path: 'packages/protocol',
        note: '`messages.ts`, `parse.ts`, `sha256.ts`, `pin.ts`, `constants.ts`, `host-internal.ts` and 9 tests',
        changed: true,
      },
      { path: 'apps/host', note: 'Not written yet; it will import this package', changed: false },
      {
        path: 'apps/viewer',
        note: 'Not written yet; it will import this package',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'A hand-written SHA-256',
        insteadOf: '`crypto.subtle` or a crypto library',
        reason:
          'The viewer is served over plain HTTP, which is not a secure context, so browsers hide `crypto.subtle` there. Our version runs the same in Node and Chrome 109 (ADR-007).',
      },
      {
        chose: 'Send a nonce and a hash proof',
        insteadOf: 'Sending the PIN',
        reason: 'Anyone sniffing the LAN then sees only a one-time hash (ADR-007).',
      },
      {
        chose: 'One parse module for all network input',
        insteadOf: 'Calling `JSON.parse` wherever a message arrives',
        reason: 'A bad viewer can then never crash the host with an unexpected shape.',
      },
      {
        chose: 'ES2020 output and no `node:` imports in the package',
        insteadOf: 'Node-only code with a bundler for the browser',
        reason: 'Chrome 109 has to run it as is, with no bundler.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '001', note: 'gave us strict TypeScript, the workspace and the test command' },
    ],
    unlocks: [
      { spec: '003', note: 'sends and receives these messages over the WebSocket' },
      { spec: '004', note: 'checks `pinProof` values' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Messages are a union',
        explanation:
          '`messages.ts` lists every message as a union with a `type` field, for example `hello`, `pair`, `pair-failed`, `offer`, `answer`, `ice`.',
      },
      {
        title: 'One parser per direction',
        explanation:
          '`parseViewerMessage` and `parseHostMessage` take a string, parse it once, check every field and return a typed message or `null`.',
      },
      {
        title: 'The nonce makes the proof one-time',
        explanation:
          'The host sends a random nonce in `hello`. The viewer answers with `pinProof(nonce, pin)`, a SHA-256 over a labelled string.',
      },
      {
        title: 'Compare without leaking',
        explanation:
          'The host computes the same proof and compares it with `constantTimeEqual`, so timing does not reveal how many characters matched.',
      },
      {
        title: 'Tests pin the hash down',
        explanation:
          'Tests compare our SHA-256 against `node:crypto` for every length from 0 to 300 and for a 1 MB input.',
      },
    ],
  },

  code: [
    {
      file: 'packages/protocol/src/pin.ts',
      excerpt: `export function pinProof(nonce: string, pin: string): string {
  return sha256Hex(\`pilotpane-pin:v1:\${nonce}:\${pin}\`);
}

/** Compares two strings in time that does not depend on where they differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}`,
      explanation:
        'The label and version in the hashed string stop a proof made for one purpose from being replayed for another. The loop always visits every character.',
    },
    {
      file: 'packages/protocol/src/sha256.ts',
      excerpt: `  // Padding: data, 0x80, zeros, then the bit length as a 64-bit big-endian number.
  const len = data.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(len / 0x20000000));
  view.setUint32(total - 4, (len * 8) >>> 0);`,
      explanation:
        'SHA-256 works on 64-byte blocks. This pads the input to a whole number of blocks and stores the message length in the last 8 bytes, as FIPS 180-4 requires.',
    },
  ],

  concepts: [
    {
      name: 'SHA-256',
      level: 'Core',
      explanation: 'The algorithm and its padding rules, implemented here from the spec.',
      resources: [
        {
          title: 'RFC 6234: US Secure Hash Algorithms',
          url: 'https://www.rfc-editor.org/rfc/rfc6234',
        },
      ],
    },
    {
      name: 'Secure contexts',
      level: 'Core',
      explanation:
        'Browsers only expose some APIs, like `crypto.subtle`, on HTTPS or localhost. Plain HTTP on a LAN address does not qualify.',
      resources: [
        {
          title: 'MDN: Secure contexts',
          url: 'https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts',
        },
        {
          title: 'MDN: SubtleCrypto',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto',
        },
      ],
    },
    {
      name: 'Typed arrays',
      level: 'Concept',
      explanation:
        '`Uint32Array` gives the 32-bit wraparound maths SHA-256 needs without extra code.',
      resources: [
        {
          title: 'MDN: Uint32Array',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array',
        },
      ],
    },
    {
      name: 'Discriminated unions',
      level: 'Pattern',
      explanation:
        'A union of object types that share a `type` field. Checking `type` tells TypeScript which fields exist.',
      resources: [
        {
          title: 'TypeScript: Narrowing',
          url: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions',
        },
      ],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why does the protocol package avoid `node:` imports outside tests?',
      answer:
        'The viewer runs the same code in Chrome 109, which has no `node:` modules and no bundler to replace them.',
    },
    {
      question:
        'Why does `constantTimeEqual` loop over the whole string instead of returning at the first difference?',
      answer:
        'Returning early would take slightly less time for a wrong guess that differs near the start, which leaks information about the secret.',
    },
    {
      question: 'If an attacker records one `pair` message, why can they not reuse it later?',
      answer:
        'The proof covers a nonce that the host makes new for every connection, so an old proof never matches a new nonce.',
    },
  ],

  commits: [
    'chore(protocol): add package manifest and tsconfig',
    'feat(protocol): add message types and constants',
    'feat(protocol): add own sha256 and pin proof',
    'feat(protocol): add message parsing and validation',
    'test(protocol): add sha256 and parse tests',
  ],
});
