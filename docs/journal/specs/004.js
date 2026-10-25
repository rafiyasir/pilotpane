window.JOURNAL.push({
  number: '004',
  title: 'PIN pairing',
  version: 'v0.1',
  mergedDate: '2026-10-21',
  technologies: ['Node crypto', 'Nonce and proof', 'Rate limiting', 'Resume tokens'],
  oneLine:
    'A viewer can now prove it knows the PIN without sending it, wrong guesses are limited, and one viewer at a time can watch.',

  what: {
    summary:
      'A `Pairing` class makes the PIN and nonces, checks proofs, counts wrong tries and issues resume tokens. A `Session` class talks to viewers over the WebSocket. Neither imports Electron, so eight tests run in plain Node.',
    partsTouched: [
      {
        path: 'apps/host',
        note: '`pairing.ts`, `session.ts` and `pairing.test.ts` (8 tests)',
        changed: true,
      },
      {
        path: 'packages/protocol',
        note: 'Provides `pinProof`, `constantTimeEqual` and the message types',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'A nonce and a hash proof',
        insteadOf: 'Sending the PIN',
        reason: 'The PIN never has to travel on the network (ADR-007).',
      },
      {
        chose: 'Pause pairing for 60 seconds after 5 wrong tries',
        insteadOf: 'Unlimited tries',
        reason:
          'A 6-digit PIN has only a million values, and the pause makes guessing impractical (ADR-007).',
      },
      {
        chose: 'Resume tokens',
        insteadOf: 'Asking for the PIN after every network drop',
        reason:
          'The viewer can reconnect on its own. A new PIN forgets every token.',
      },
      {
        chose: 'A single active viewer',
        insteadOf: 'Several viewers',
        reason: 'Each viewer needs its own encode, which hurts slow links (ADR-005).',
      },
      {
        chose: '`Pairing` and `Session` with no Electron imports',
        insteadOf: 'Mixing them into the Electron code',
        reason: 'They can then be tested in plain Node.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '002', note: 'gave us `pinProof`' },
      { spec: '003', note: 'gave us the WebSocket connection' },
    ],
    unlocks: [
      { spec: '005', note: 'starts the capture when a viewer is promoted to active' },
      { spec: '006', note: 'the viewer answers `hello` with the PIN screen' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Greet with a nonce',
        explanation:
          'A new connection receives `hello` with a fresh nonce and the protocol version.',
      },
      {
        title: 'Check the proof',
        explanation:
          'The viewer sends `pair` with `pinProof(nonce, pin)`. The host computes the same value and compares in constant time.',
      },
      {
        title: 'Promote one viewer',
        explanation:
          'A match gives the viewer a random token and promotes it to the active viewer. A second viewer gets `busy` and is closed.',
      },
      {
        title: 'Count wrong tries',
        explanation:
          'A mismatch returns `pair-failed` with the reason and how many tries are left. The fifth wrong try starts the 60-second pause.',
      },
      {
        title: 'Resume without the PIN',
        explanation:
          'After a network drop the viewer sends `resume` with its token and skips the PIN. `newPin()` clears all tokens, so a new PIN ends every old pairing.',
      },
    ],
  },

  code: [
    {
      file: 'apps/host/src/main/pairing.ts',
      excerpt: `    if (constantTimeEqual(pinProof(nonce, this.currentPin), proof.toLowerCase())) {
      this.wrongAttempts = 0;
      const token = randomBytes(24).toString('base64url');
      this.tokens.add(token);
      return { ok: true, token };
    }

    this.wrongAttempts += 1;
    if (this.wrongAttempts >= MAX_PIN_ATTEMPTS) {`,
      explanation:
        'The success path resets the counter and mints a 24-byte random token. Every miss counts, and the last allowed one starts the lock.',
    },
    {
      file: 'apps/host/src/main/session.ts',
      excerpt: `            this.send(conn, {
              type: 'pair-failed',
              reason: result.reason,
              attemptsLeft: result.attemptsLeft,
              retryAfterSec: result.retryAfterSec
            });`,
      explanation:
        'Explicit fields, not the whole result object. Only what the protocol defines goes out to the viewer.',
    },
  ],

  concepts: [
    {
      name: 'Cryptographic randomness',
      level: 'Core',
      explanation:
        '`randomInt` and `randomBytes` draw from the operating system, so PINs, nonces and tokens cannot be predicted the way `Math.random` output can.',
      resources: [
        {
          title: 'Node.js: crypto.randomInt',
          url: 'https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback',
        },
        {
          title: 'Node.js: crypto.randomBytes',
          url: 'https://nodejs.org/api/crypto.html#cryptorandombytessize-callback',
        },
      ],
    },
    {
      name: 'Timing-safe comparison',
      level: 'Core',
      explanation:
        'Comparing secrets in time that does not depend on where they differ. Node has a built-in version of what `constantTimeEqual` does.',
      resources: [
        {
          title: 'Node.js: crypto.timingSafeEqual',
          url: 'https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b',
        },
      ],
    },
    {
      name: 'Rate limiting',
      level: 'Pattern',
      explanation:
        'Capping wrong guesses makes a small secret like a 6-digit PIN safe enough for a LAN. A clock passed in as a function makes the pause easy to test.',
      resources: [
        {
          title: 'OWASP: Blocking Brute Force Attacks',
          url: 'https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks',
        },
      ],
    },
    {
      name: 'WebSocket close codes',
      level: 'Concept',
      explanation:
        'How `busy` ends a connection politely, with a code the other side can read.',
      resources: [
        {
          title: 'RFC 6455, section 7.4',
          url: 'https://www.rfc-editor.org/rfc/rfc6455#section-7.4',
        },
      ],
    },
  ],

  bugs: [
    {
      symptom: 'The `pair-failed` message sent to the viewer had an extra `ok: false` field.',
      cause:
        'The internal result of `Pairing.verify` has an `ok` field, and it leaked into the message that went to the viewer.',
      fix: 'Send explicit fields (`reason`, `attemptsLeft`, `retryAfterSec`), as in the second code excerpt, so only what the protocol defines goes out.',
    },
  ],

  quiz: [
    {
      question:
        'Why does `verify` clear the lock the first time it is called after the pause ends?',
      answer:
        'Otherwise the old wrong-attempt count would survive the pause and the viewer would be locked again after one wrong try.',
    },
    {
      question: 'What happens to a viewer\'s token when the host presses "New PIN"?',
      answer:
        'All tokens are cleared, so a resume with the old token fails with `bad-token` and the viewer has to type the new PIN.',
    },
    {
      question:
        'Why is the `Pairing` class given a `now` function instead of calling `Date.now()` directly?',
      answer:
        'Tests can pass a fake clock and check the 60-second lock and unlock without waiting.',
    },
  ],

  commits: [
    'feat(host): add pin pairing with lockout and resume tokens',
    'feat(host): add single viewer session',
    'test(host): add pairing tests',
  ],
});
