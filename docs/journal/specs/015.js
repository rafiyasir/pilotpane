window.JOURNAL.push({
  number: '015',
  title: 'Quality presets',
  version: 'v0.4',
  mergedDate: '2026-10-23',
  technologies: ['RTCPeerConnection stats', 'localStorage', 'Pure functions', 'node:test'],
  oneLine:
    'The viewer can pick Auto, which lowers or raises the picture quality as the link gets worse or better, and it remembers your last choice.',

  what: {
    summary:
      'The presets 1080p, 720p and Low already existed, but you had to choose by hand. This spec adds an Auto option. Every second the viewer already measures loss and round-trip time, and a small pure function decides whether to step down one preset, step up one preset, or stay. The viewer remembers its choice (Auto or a preset) in browser storage and restores it after pairing, and the stats overlay now shows which preset is in use. No new network message was needed: Auto just sends the existing `set-quality`.',
    partsTouched: [
      {
        path: 'packages/protocol/src/auto-quality.ts',
        note: 'New: `autoStart` and `autoStep`, the decision rules as a pure function with tests',
        changed: true,
      },
      {
        path: 'apps/viewer/src/main.ts',
        note: 'Auto mode, the stored choice, and feeding each stats sample to `autoStep`',
        changed: true,
      },
      {
        path: 'apps/viewer/src/index.html',
        note: 'The "Auto" option in the quality select and the "quality" pair in the stats overlay',
        changed: true,
      },
      {
        path: 'apps/host',
        note: 'No change: the host already handles `set-quality`',
        changed: false,
      },
      {
        path: 'DESIGN.md and docs',
        note: 'Architecture note on Auto; DESIGN.md mentions the new option and stats pair',
        changed: true,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Run Auto on the viewer and send the existing `set-quality`',
        insteadOf: 'A new message or a decision made on the host',
        reason:
          'The viewer already measures what the user sees (loss and round trip), so it can decide without any protocol change. The protocol version stays at 2.',
      },
      {
        chose: 'Judge the link by loss and round-trip time only',
        insteadOf: 'Also stepping down when the frame rate is low',
        reason:
          'A still desktop sends very few frames on a perfectly good link. A low-fps rule would lower quality for no reason, so a test now checks that an idle screen stays put.',
      },
      {
        chose: 'Step one preset at a time, with a quick drop (about 6 s), a slow rise (about 30 s) and at least 15 s between changes',
        insteadOf: 'Jumping straight to the best preset or reacting to every sample',
        reason: 'Dropping fast protects a struggling link, and rising slowly stops the picture flapping between two presets.',
      },
      {
        chose: 'Put the rules in `packages/protocol` as a function with no timers or DOM',
        insteadOf: 'Writing them inside the viewer page',
        reason: 'It runs in Node and Chrome 109, so the rules can be unit tested with fake time instead of waiting 30 seconds.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '008', note: 'The viewer already measures stats every second' },
      { spec: '012', note: 'The Low preset and the `set-quality` message' },
    ],
    unlocks: [{ spec: '016', note: 'Reconnect after host sleep can restore the remembered quality too' }],
  },

  how: {
    steps: [
      {
        title: 'Collect a sample',
        explanation:
          'The existing stats timer reads `getStats()` once a second. It already updates the overlay and sends `stats` to the host.',
      },
      {
        title: 'Ask the rules',
        explanation:
          'In Auto mode the sample goes to `autoStep` with the current time. It tracks how long the link has been bad or quiet and returns a new state.',
      },
      {
        title: 'Change the preset',
        explanation:
          'If the returned preset differs from the one in use, the viewer sends `set-quality`. The host applies it on the live connection, with no reconnect.',
      },
      {
        title: 'Remember and restore',
        explanation:
          'The choice is saved in safe storage. When the picture starts, the viewer restores it, or starts Auto if nothing valid is stored.',
      },
    ],
  },

  code: [
    {
      file: 'packages/protocol/src/auto-quality.ts',
      excerpt: `  const next: AutoState = { ...state, badSince, goodSince };
  if (now - state.changedAt < AUTO_MIN_GAP_MS) return next;

  const index = QUALITY_PRESETS.indexOf(state.preset);
  if (badSince !== null && now - badSince >= AUTO_DOWN_AFTER_MS) {
    const lower = QUALITY_PRESETS[index + 1];
    if (lower) return { preset: lower, badSince: null, goodSince: null, changedAt: now };
  }
  if (goodSince !== null && now - goodSince >= AUTO_UP_AFTER_MS) {
    const higher = QUALITY_PRESETS[index - 1];
    if (higher) return { preset: higher, badSince: null, goodSince: null, changedAt: now };
  }
  return next;`,
      explanation:
        'The whole decision. `QUALITY_PRESETS` is ordered best first, so one step down is the next index and one step up is the previous one. Past the ends the lookup is undefined, so Auto cannot leave the range Low to 1080p.',
    },
    {
      file: 'apps/viewer/src/main.ts',
      excerpt: `    if (qualityMode === 'auto') {
      auto = autoStep(auto, s, Date.now());
      if (auto.preset !== currentPreset) socket.send({ type: 'set-quality', preset: auto.preset });
    }`,
      explanation: 'The viewer side is three lines: step the rules, and send only when the answer changed.',
    },
    {
      file: 'apps/viewer/src/main.ts',
      excerpt: `function applyStoredQuality(): void {
  const stored = store.get('local', QUALITY_KEY);
  if (isQualityPreset(stored)) {
    setQualityMode(stored);
    if (stored !== currentPreset) socket.send({ type: 'set-quality', preset: stored });
  } else {
    setQualityMode('auto');
    auto = autoStart(currentPreset, Date.now());
  }
}`,
      explanation:
        'A stored preset is checked with `isQualityPreset`, so junk such as "4k" falls through to Auto instead of being sent to the host.',
    },
  ],

  concepts: [
    {
      name: 'Pure functions',
      level: 'Core',
      explanation:
        'A function whose result depends only on its inputs, with no clock, DOM or network inside. Time is passed in as `now`, which is why the tests can run 30 seconds of "link quiet" instantly.',
      resources: [
        { title: 'MDN: Functions', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions' },
      ],
    },
    {
      name: 'WebRTC statistics',
      level: 'Concept',
      explanation:
        '`RTCPeerConnection.getStats()` reports packets lost and round-trip time. Auto turns those raw numbers into one decision.',
      resources: [
        {
          title: 'MDN: RTCPeerConnection.getStats()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats',
        },
        { title: 'W3C: Identifiers for WebRTC Statistics', url: 'https://www.w3.org/TR/webrtc-stats/' },
      ],
    },
    {
      name: 'Hysteresis',
      level: 'Pattern',
      explanation:
        'Using different thresholds and delays for going down and up so a system does not flip back and forth. Here: 6 s to drop, 30 s to rise, and 15 s between changes.',
      resources: [],
    },
    {
      name: 'Web Storage',
      level: 'Concept',
      explanation:
        '`localStorage` keeps the choice between visits, but it can throw in private mode, so every read and write is wrapped and the page works without it.',
      resources: [
        { title: 'MDN: Web Storage API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API' },
      ],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why does Auto ignore a low frame rate?',
      answer: 'A still desktop sends few frames even on a perfect link, so low fps does not mean the link is struggling.',
    },
    {
      question: 'Why is stepping up slower than stepping down?',
      answer: 'A struggling link needs relief quickly, while a slow rise stops the picture flapping between two presets.',
    },
    {
      question: 'Why can the rules be tested without waiting?',
      answer: 'They are a pure function that takes the current time as an argument, so a test supplies fake times.',
    },
  ],

  commits: [],
  commitsNote: 'Not committed yet. This list fills in once the branch is committed with /prepare-pr.',
});
