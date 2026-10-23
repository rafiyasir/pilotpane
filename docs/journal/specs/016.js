window.JOURNAL.push({
  number: '016',
  title: 'Auto-reconnect after host sleep',
  version: 'v0.4',
  mergedDate: '2026-10-23',
  technologies: ['RTCPeerConnection stats', 'Electron powerMonitor', 'WebSocket close', 'Page Visibility', 'node:test'],
  oneLine:
    'When the host sleeps or loses its network, the viewer notices quickly, keeps the last picture, and comes back by itself with no PIN.',

  what: {
    summary:
      'Resume tokens and a retry loop already existed, but they only worked when the connection closed cleanly. This spec closes the gaps. The viewer now notices a link that has gone silent without any close (a sleeping host, a pulled cable) by watching the bytes its transport receives. It retries at once when the browser comes back online or the tab becomes visible, instead of waiting out the delay. The host closes the viewer socket when it goes to sleep, without a `bye`, so the viewer keeps its token and retries, and on wake it re-checks its network addresses right away. No new network message was needed.',
    partsTouched: [
      {
        path: 'packages/protocol/src/link-watch.ts',
        note: 'New: `LinkWatch`, a tiny class that says whether the link is dead, with tests',
        changed: true,
      },
      {
        path: 'apps/viewer/src/main.ts and receiver.ts',
        note: 'Feeds `LinkWatch` from the stats timer; retries at once on `online` and when the tab is shown',
        changed: true,
      },
      {
        path: 'apps/host/src/main/platform/power.ts',
        note: 'New: the `PowerEvents` interface, a null version, and an Electron version in `electron-power.ts`',
        changed: true,
      },
      {
        path: 'apps/host/src/main/controller.ts and session.ts',
        note: 'Closes the active viewer on suspend and polls the network on resume',
        changed: true,
      },
      {
        path: 'docs',
        note: 'Architecture step 10 and a "When the host sleeps" note in the connection guide',
        changed: true,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Judge the link by total bytes the transport receives',
        insteadOf: 'Counting video frames or decoded frames',
        reason:
          'A still desktop sends almost no video, so a frame count would call a healthy link dead. The transport also carries RTCP and ICE keep-alives, so it is never silent unless the link is really gone.',
      },
      {
        chose: 'Close the viewer socket on suspend without sending `bye`',
        insteadOf: 'Using `kick`, which sends `bye` with a reason',
        reason:
          'A `bye` makes the viewer stop trying and show "Disconnected". A plain close looks like a network drop, so the viewer keeps its token and reconnects when the host wakes.',
      },
      {
        chose: 'Put `LinkWatch` in `packages/protocol`',
        insteadOf: 'Putting it in the viewer folder next to `main.ts`',
        reason:
          'The viewer has no test runner, and the protocol package runs under `node --test`. A class with no timers or DOM can be tested with fake time.',
      },
      {
        chose: 'Hide Electron behind a `PowerEvents` interface',
        insteadOf: 'Calling `powerMonitor` directly in the controller',
        reason: 'It matches `KeepAwake` and `InputInjector`: a macOS or Linux host replaces only the implementation.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '004', note: 'Resume tokens, so a returning viewer skips the PIN' },
      { spec: '007', note: 'The controller that owns the network poll and the viewer session' },
      { spec: '008', note: 'The stats timer the viewer already runs every second' },
    ],
    unlocks: [{ spec: '017', note: 'Keeping the host awake builds on the same power-event wiring' }],
  },

  how: {
    steps: [
      {
        title: 'The host tells the viewer it is going to sleep',
        explanation:
          'On `suspend` the controller calls `dropActive`, which closes the socket with a "going away" code and no `bye`. If the laptop sleeps before that gets through, the viewer still finds out in the next step.',
      },
      {
        title: 'The viewer notices a silent link',
        explanation:
          'Every second the stats timer reads the transport byte count and hands it to `LinkWatch`. If the number has not moved for 8 seconds, the viewer closes its socket and runs the same drop path as a normal close.',
      },
      {
        title: 'The viewer keeps the last frame and retries',
        explanation:
          'The reconnecting banner shows over the last picture. Retries back off (1, 2, 4, 8, 10 s) and send `resume { token }` instead of the PIN. If the browser fires `online` or the tab becomes visible, the wait is skipped and the next try starts at once.',
      },
      {
        title: 'The host wakes and looks at its network',
        explanation:
          'On `resume` the controller polls its addresses immediately instead of waiting for the next 3 second poll, so the listeners are ready when the viewer knocks. A stale socket from the same viewer is already replaced by `promote`.',
      },
      {
        title: 'The stream starts again',
        explanation:
          'The host accepts the token, sends `paired`, and starts the engine. The viewer stays in the reconnecting phase until the video connects, then returns to the stage. If the PIN changed in between, the token is rejected and the viewer shows the PIN form.',
      },
    ],
  },

  code: [
    {
      file: 'packages/protocol/src/link-watch.ts',
      excerpt: `export class LinkWatch {
  private bytes: number | null = null;
  private movedAt = 0;

  constructor(private readonly deadAfterMs: number = LINK_DEAD_AFTER_MS) {}

  /** Returns true when the link has gone dead. */
  sample(now: number, totalBytes: number): boolean {
    if (this.bytes === null || totalBytes !== this.bytes) {
      this.bytes = totalBytes;
      this.movedAt = now;
      return false;
    }
    return now - this.movedAt >= this.deadAfterMs;
  }`,
      explanation:
        'The whole idea in a few lines: remember the last byte count and when it last changed. Time is passed in, so tests need no timers.',
    },
    {
      file: 'apps/viewer/src/main.ts',
      excerpt: `    const bytes = await receiver.transportBytes().catch(() => null);
    if (bytes !== null && phase === 'streaming' && linkWatch.sample(Date.now(), bytes)) {
      console.warn('[pilotpane] the link went quiet, reconnecting');
      socket.dispose();
      onDrop();
      return;
    }`,
      explanation:
        'A dead link takes the same path as a socket close, so the retry loop, the banner and `endControl` all work as before. The phase check stops a late result from firing after the stream has ended.',
    },
    {
      file: 'apps/host/src/main/controller.ts',
      excerpt: `    this.opts.power.onSuspend(() => {
      log.info('going to sleep, closing the viewer link');
      this.sessions.dropActive('host asleep');
    });
    this.opts.power.onResume(() => {
      log.info('woke up, checking the network now');
      this.pollNetwork();
    });`,
      explanation: 'The controller only knows the `PowerEvents` interface. The Electron version is built in `main.ts`.',
    },
  ],

  concepts: [
    {
      name: 'RTCPeerConnection.getStats',
      level: 'Core',
      explanation:
        'Returns a report of the connection. The `transport` entry has `bytesReceived`, which counts everything on the link, not just video. That makes it a good heartbeat.',
      resources: [
        { title: 'RTCPeerConnection.getStats() (MDN)', url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats' },
        { title: 'RTCTransportStats (MDN)', url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCStatsReport#transport' },
      ],
    },
    {
      name: 'Electron powerMonitor',
      level: 'Concept',
      explanation:
        'Emits `suspend` just before the computer sleeps and `resume` when it wakes. It can only be used after the app is ready.',
      resources: [{ title: 'powerMonitor (Electron docs)', url: 'https://www.electronjs.org/docs/latest/api/power-monitor' }],
    },
    {
      name: 'Silent failure detection',
      level: 'Pattern',
      explanation:
        'A closed connection is easy to see. A dead one that never sends a close is not, because TCP stays "open" until it times out. The fix is a heartbeat: expect traffic, and treat silence as failure after a set time.',
      resources: [
        { title: 'The WebSocket Protocol, ping and pong (RFC 6455)', url: 'https://www.rfc-editor.org/rfc/rfc6455#section-5.5.2' },
        { title: 'ICE consent freshness (RFC 7675)', url: 'https://www.rfc-editor.org/rfc/rfc7675' },
      ],
    },
    {
      name: 'Page Visibility and online events',
      level: 'Concept',
      explanation:
        'Browsers slow timers in hidden tabs and fire `online` when the network returns. Both are good moments to try again instead of waiting for the next scheduled retry.',
      resources: [
        { title: 'Page Visibility API (MDN)', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API' },
        { title: 'Window: online event (MDN)', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event' },
      ],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why does `LinkWatch` count transport bytes and not video frames?',
      answer:
        'A still desktop sends almost no video on a healthy link. The transport also carries RTCP and ICE keep-alives, so its byte count keeps moving unless the link is really dead.',
    },
    {
      question: 'Why does the host close the socket on suspend without a `bye`?',
      answer:
        'A `bye` tells the viewer to stop trying. A plain close looks like a network drop, so the viewer keeps its token and reconnects when the host wakes.',
    },
    {
      question: 'What happens if the host got a new PIN while the viewer was away?',
      answer: 'The resume token is rejected with `bad-token`, so the viewer clears it and shows the PIN form instead of retrying forever.',
    },
  ],

  commits: [],
  commitsNote: 'The commits for this spec are listed once the branch is committed and tagged `spec-016-done`.',
});
