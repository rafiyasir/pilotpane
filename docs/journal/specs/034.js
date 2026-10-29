window.JOURNAL.push({
  number: '034',
  title: 'Pause that both sides understand',
  version: 'v0.4',
  mergedDate: '2026-10-29',
  technologies: ['WebSocket', 'Electron BrowserWindow', 'TypeScript unions'],
  oneLine:
    'Pausing the host no longer shows a PIN nobody can use, and a waiting viewer comes back by itself when sharing resumes.',

  what: {
    summary:
      'Real use found two problems. Pause closed the network listeners but the big PIN screen could still open from the tray or a second launch, so it showed a PIN that could not work. And a pause told the viewer "host-stopped", the same as closing the app, so the viewer gave up and nobody noticed when sharing resumed. Now pause has its own `bye` reason, `paused`. The viewer keeps its token and last picture, says that sharing is paused, and retries with the normal backoff. The host has one `canShowPin()` check, so no PIN window opens while paused.',
    partsTouched: [
      {
        path: 'packages/protocol',
        note: '`bye` gains the reason `paused`, `PROTOCOL_VERSION` goes from 2 to 3, with a parser test',
        changed: true
      },
      {
        path: 'apps/host/src/main/controller.ts',
        note: '`canShowPin()`, PIN window closes on pause and reopens on resume, `bye paused` for new sockets while paused',
        changed: true
      },
      { path: 'apps/host/src/main/session.ts', note: '`kick()` accepts `paused`', changed: true },
      {
        path: 'apps/viewer/src/main.ts',
        note: 'Handles `bye paused` with the retry loop and the paused text',
        changed: true
      },
      { path: 'docs/DECISIONS.md and docs/ARCHITECTURE.md', note: 'ADR-017 and the message table', changed: true },
      { path: 'apps/host/src/main/net and pairing.ts', note: 'Untouched', changed: false }
    ]
  },

  why: {
    decisions: [
      {
        chose: 'A new `bye` reason, `paused`',
        insteadOf: 'Reusing `host-stopped`, or closing the socket with no `bye` as for sleep',
        reason:
          '`host-stopped` also means the app was closed, and then the viewer should stop and say so. A pause is temporary, so the viewer should wait. Two different meanings need two different reasons.'
      },
      {
        chose: 'Bump `PROTOCOL_VERSION` to 3',
        insteadOf: 'Adding the reason and keeping version 2',
        reason:
          'An old viewer page would drop a reason it does not know. The host serves the viewer page, so both sides match in practice, but the rule is that a changed message shape bumps the version.'
      },
      {
        chose: 'One `canShowPin()` guard inside `showPinWindow()`',
        insteadOf: 'Checking the paused flag in every caller (tray, second launch, startup)',
        reason: 'Callers cannot forget the check, and the rule "no PIN while paused or quitting" lives in one place.'
      },
      {
        chose: 'Send `bye paused` to sockets that connect while paused',
        insteadOf: 'Closing them silently',
        reason:
          'A viewer that retries during a pause would otherwise not know why. The paused flag in the viewer is cleared before each retry, so a host that quit during the pause is not mistaken for a paused one.'
      }
    ]
  },

  when: {
    dependsOn: [
      { spec: '007', note: 'the host window, tray and PIN window' },
      { spec: '016', note: 'the viewer retry loop with backoff and resume tokens' }
    ],
    unlocks: [{ spec: '035', note: 'close notice and Quit button, which share the same window rules' }]
  },

  how: {
    steps: [
      {
        title: 'Host pauses',
        explanation:
          'The controller sets `paused`, kicks the viewer with `paused`, closes the LAN listeners and closes the PIN window.'
      },
      {
        title: 'Viewer sees `bye paused`',
        explanation:
          'It only sets a flag. It does not stop. The socket closes right after, and the existing close handler starts the retry loop.'
      },
      {
        title: 'Retry shows why',
        explanation:
          'While the flag is set, the banner over the last picture says sharing is paused. Before each retry the flag is cleared, so only a host that really says `paused` again keeps the paused text.'
      },
      {
        title: 'Resume',
        explanation:
          'The listeners come back, the PIN window opens if no viewer is connected, and the next retry reaches the host. The viewer resumes with its token, so no PIN is needed.'
      }
    ]
  },

  code: [
    {
      file: 'apps/host/src/main/controller.ts',
      excerpt: `  /** The big PIN is only useful while the host can be reached. */
  private canShowPin(): boolean {
    return !this.paused && !this.quitting;
  }`,
      explanation: 'The single rule for when the PIN window may open.'
    },
    {
      file: 'apps/host/src/main/controller.ts',
      excerpt: `        if (this.paused) {
          // Tell a waiting viewer why, so it keeps retrying instead of giving up.
          conn.send(JSON.stringify({ type: 'bye', reason: 'paused' } satisfies HostMessage));
          conn.close(1000, 'paused');
          return;
        }`,
      explanation:
        'A socket that connects during a pause gets the reason first. `satisfies HostMessage` makes the compiler check the shape without widening the type.'
    },
    {
      file: 'apps/viewer/src/main.ts',
      excerpt: `  if (reason === 'paused') {
    // The socket closes right after this; its close event runs onDrop and the retry loop.
    hostPaused = true;
    return;
  }`,
      explanation: 'The viewer does nothing else: the normal drop path already does the retrying.'
    },
    {
      file: 'apps/viewer/src/main.ts',
      excerpt: `  retryTimer = window.setTimeout(() => {
    hostPaused = false; // a paused host says so again; a host that quit does not
    socket.connect();
  }, delay);`,
      explanation: 'Clearing the flag before every attempt keeps the text honest if the host quit while paused.'
    }
  ],

  concepts: [
    {
      name: 'WebSocket close and messages',
      level: 'Core',
      explanation:
        'A message sent just before close arrives before the close event, so a `bye` can carry the reason for the close.',
      resources: [
        { title: 'MDN: WebSocket', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebSocket' },
        { title: 'RFC 6455: The WebSocket Protocol', url: 'https://www.rfc-editor.org/rfc/rfc6455' }
      ]
    },
    {
      name: 'Union types and satisfies',
      level: 'Concept',
      explanation:
        'The reason is a union of string literals. Adding a member makes the compiler show every place that must handle it. `satisfies` checks an object against a type without changing its inferred type.',
      resources: [
        {
          title: 'TypeScript handbook: Everyday Types',
          url: 'https://www.typescriptlang.org/docs/handbook/2/everyday-types.html'
        },
        {
          title: 'TypeScript 4.9 release notes: satisfies',
          url: 'https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html'
        }
      ]
    },
    {
      name: 'One place for a rule',
      level: 'Pattern',
      explanation:
        'A guard inside the function that does the work cannot be skipped by a new caller. It is cheaper than checking at every call site.',
      resources: [
        { title: 'Electron docs: BrowserWindow', url: 'https://www.electronjs.org/docs/latest/api/browser-window' }
      ]
    }
  ],

  quiz: [
    {
      question: 'Why is `paused` a separate `bye` reason and not `host-stopped`?',
      answer:
        '`host-stopped` means the app is closing, so the viewer should stop. `paused` is temporary, so the viewer should keep retrying and keep the last picture.'
    },
    {
      question: 'Why does the viewer clear its paused flag before each retry?',
      answer:
        'If the host quit during the pause, no `bye` arrives on the retry, and the viewer should show the normal "Can\'t reach the host" text, not a stale paused one.'
    },
    {
      question: 'Why does `PROTOCOL_VERSION` go up for one new reason?',
      answer: 'An old viewer would drop a `bye` with a reason it does not know, so the shape changed.'
    }
  ],

  commitsNote:
    'The commits for this spec are added when the branch is prepared for the pull request. Use the Commits button once the spec-034-done tag exists.'
});
