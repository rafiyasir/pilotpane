window.JOURNAL.push({
  number: '012',
  title: 'Low-bandwidth preset',
  version: 'v0.2',
  mergedDate: '2026-10-23',
  technologies: ['RTCRtpSender', 'Bitrate and frame rate caps', 'Protocol versioning', 'localStorage', 'node:test'],
  oneLine: 'A third quality choice, Low, keeps the picture moving on very slow links such as Bluetooth.',

  what: {
    summary:
      'The viewer toolbar now offers Low next to 1080p and 720p. Low sends a 480p picture at 15 frames a second and no more than 1 Mbps, which fits a Bluetooth link that 720p cannot. The first time someone picks it, a small card explains what it does. Each preset now also carries its own frame rate cap, so Low can drop frames without touching the other two.',
    partsTouched: [
      {
        path: 'packages/protocol/src/constants.ts',
        note: 'The `low` preset, `maxFramerate` on every preset, protocol version 2',
        changed: true,
      },
      {
        path: 'apps/host/src/renderer/engine/engine.ts',
        note: 'Uses the preset frame rate instead of a fixed 30',
        changed: true,
      },
      {
        path: 'apps/viewer/src',
        note: 'The Low option in `index.html`, and the one-time hint in `control.ts` and `main.ts`',
        changed: true,
      },
      {
        path: 'apps/host/src/main/settings.ts',
        note: 'No code change: it already accepted any known preset. A new test proves `low` is saved and junk is not',
        changed: false,
      },
      {
        path: 'docs',
        note: 'ADR-014, the Bluetooth guide, the architecture and the README table',
        changed: true,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'A fixed Low preset the user picks by hand',
        insteadOf: 'Automatic quality adaptation',
        reason:
          'It is small, easy to test and needs no new messages. Adapting by itself from the `stats` the viewer already sends is a good later step, and would also suit any future internet use (ADR-014).',
      },
      {
        chose: '480p, 15 fps, 0.3 / 0.6 / 1 Mbps',
        insteadOf: 'Lowering the 720p floor',
        reason:
          'Bluetooth gives roughly 1 to 2 Mbps in practice, and the 720p floor of 1.5 Mbps stalls there. A separate preset leaves 1080p and 720p exactly as they were.',
      },
      {
        chose: 'A frame rate cap on each preset',
        insteadOf: 'A fixed 30 in the engine',
        reason:
          'Fewer frames is the cheapest way to save data on a slow link, and it belongs in the same table as the bitrate.',
      },
      {
        chose: 'Bump `PROTOCOL_VERSION` to 2',
        insteadOf: 'Leaving it at 1 because the change is small',
        reason:
          'An old peer would drop a `quality` message that says `low`. The rule is that a changed message shape bumps the version. The host serves the viewer, so both sides always match in practice.',
      },
      {
        chose: 'One more option in the existing select, and the existing control card for the hint',
        insteadOf: 'A new chip and a new card',
        reason:
          'The viewer already has a quality select and a one-time hint card from the mouse work, so nothing new needed designing.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '005', note: 'the quality presets and the sender parameters they set' },
      { spec: '008', note: 'the stats the viewer sends, and the debug stats used to check the result' },
    ],
    unlocks: [{ spec: '015', note: 'quality presets can grow into automatic adaptation from the same table' }],
  },

  how: {
    steps: [
      {
        title: 'Pick a preset',
        explanation:
          'The select sends `set-quality { preset: "low" }`. The host checks it with `isQualityPreset`, saves it and tells the engine.',
      },
      {
        title: 'Apply it to the live sender',
        explanation:
          '`applyQuality` scales the capture down to 480 lines and sets `maxBitrate` and `maxFramerate` from the preset. This works on a running connection, so there is no reconnect.',
      },
      {
        title: 'Confirm to the viewer',
        explanation:
          'The host replies with `quality { preset }`. When that says `low`, the viewer shows the hint card unless it has been dismissed before.',
      },
      {
        title: 'Remember the hint',
        explanation:
          '"Got it" stores a flag in `localStorage` inside a try/catch. If storage is blocked, the card simply shows again next time.',
      },
    ],
  },

  code: [
    {
      file: 'packages/protocol/src/constants.ts',
      excerpt: `export const QUALITY_SPECS: Record<QualityPreset, QualitySpec> = {
  '1080p': { height: 1080, maxFramerate: 30, minBitrate: 3_000_000, startBitrate: 6_000_000, maxBitrate: 12_000_000 },
  '720p': { height: 720, maxFramerate: 30, minBitrate: 1_500_000, startBitrate: 3_000_000, maxBitrate: 6_000_000 },
  // For very slow links such as Bluetooth PAN (about 1 to 2 Mbps in practice).
  low: { height: 480, maxFramerate: 15, minBitrate: 300_000, startBitrate: 600_000, maxBitrate: 1_000_000 }
};`,
      explanation:
        'Every preset in one table. `Record<QualityPreset, QualitySpec>` makes TypeScript refuse a preset that has no entry, so the host cannot forget one.',
    },
    {
      file: 'apps/host/src/renderer/engine/engine.ts',
      excerpt: `  enc.maxBitrate = spec.maxBitrate;
  enc.maxFramerate = spec.maxFramerate;`,
      explanation: 'The only engine change: the frame rate comes from the preset instead of being 30 for everyone.',
    },
    {
      file: 'apps/viewer/src/control.ts',
      excerpt: `  /** The Low preset is active: explain it once per browser. */
  onLowSelected(): void {
    if (!this.store.lowHintSeen()) this.showCard('low', false);
  }`,
      explanation:
        'The hint reuses the card the mouse hint already uses. The store is passed in, so the "seen" flag is easy to swap or fake.',
    },
    {
      file: 'apps/host/src/main/settings.test.ts',
      excerpt: `test('a junk stored quality falls back to the default', () => {
  inTempDir((file) => {
    writeFileSync(file, JSON.stringify({ quality: '4k' }));
    assert.equal(loadSettings(file).quality, DEFAULT_SETTINGS.quality);
  });
});`,
      explanation:
        'A settings file can be edited by hand, so a bad value must fall back to the default instead of crashing the host.',
    },
  ],

  concepts: [
    {
      name: 'RTCRtpSender.setParameters()',
      level: 'Core',
      explanation:
        'Lets the app change how a live video track is sent: the highest bitrate, the highest frame rate and how much to scale down. It takes effect without a new connection.',
      resources: [
        {
          title: 'MDN: RTCRtpSender.setParameters()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/setParameters',
        },
      ],
    },
    {
      name: 'Bitrate and frame rate',
      level: 'Concept',
      explanation:
        'Bitrate is how much data per second the video uses. Fewer pixels and fewer frames both lower it. On a slow link a smooth small picture beats a sharp one that freezes.',
      resources: [
        {
          title: 'MDN: Codecs used by WebRTC',
          url: 'https://developer.mozilla.org/en-US/docs/Web/Media/Formats/WebRTC_codecs',
        },
      ],
    },
    {
      name: 'Web Storage',
      level: 'Pattern',
      explanation:
        '`localStorage` keeps small values in the browser, but it can throw when site data is blocked. Wrapping each use in try/catch lets the page work without it.',
      resources: [
        {
          title: 'MDN: Web Storage API',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API',
        },
      ],
    },
    {
      name: 'Mapped types with Record',
      level: 'Concept',
      explanation:
        '`Record<QualityPreset, QualitySpec>` means every name in the union must have an entry. Adding `low` to the list without a spec is a compile error.',
      resources: [
        {
          title: 'TypeScript Handbook: Record',
          url: 'https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type',
        },
      ],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why was Low added instead of lowering the 720p floor?',
      answer:
        'The 720p floor of 1.5 Mbps stalls on Bluetooth, but lowering it would change 720p for everyone. A separate preset leaves the others alone.',
    },
    {
      question: 'Why does changing preset not need a reconnect?',
      answer: '`setParameters` changes the cap on the live sender. Only the min and start hints in the SDP are read once, at connect.',
    },
    {
      question: 'Why was the protocol version bumped for one new value?',
      answer: 'An old peer would drop a `quality` message with `low`, so the message shape changed in a way old peers cannot read.',
    },
    {
      question: 'What happens if `settings.json` says "4k"?',
      answer: 'It is not a known preset, so the host falls back to 1080p and keeps running.',
    },
  ],

  commits: [],
  commitsNote: 'The commits for this spec are made when the pull request is prepared, so none are listed yet.',
});
