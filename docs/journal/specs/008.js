window.JOURNAL.push({
  number: '008',
  title: 'Status and stats overlay',
  version: 'v0.1',
  mergedDate: '2026-10-21',
  technologies: ['RTCPeerConnection.getStats', 'WebRTC statistics', 'Rate from counters'],
  oneLine:
    'Both sides can now see how the stream is doing: latency, fps, bitrate, size, codec and loss.',

  what: {
    summary:
      "The viewer reads WebRTC statistics every second, turns byte counters into fps and kbps, and shows six values in an overlay. Every second tick it also sends the numbers to the host, which validates them and shows them in its window.",
    partsTouched: [
      {
        path: 'apps/viewer/src/receiver.ts',
        note: '`stats()` reads WebRTC statistics and turns byte counters into fps and kbps',
        changed: true,
      },
      {
        path: 'apps/viewer/src/main.ts',
        note: 'Updates the overlay every second, remembers if it is shown, sends stats to the host every second tick',
        changed: true,
      },
      {
        path: 'packages/protocol',
        note: '`StreamStats`, the viewer `stats` message and its validation',
        changed: false,
      },
      {
        path: 'apps/host/src/main/session.ts',
        note: 'Accepts `stats` only from the active viewer',
        changed: false,
      },
      {
        path: 'apps/host/src/renderer/host',
        note: 'Shows the numbers and the connection time in the host window',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: "The browser's own `getStats()`",
        insteadOf: 'Measuring on the host',
        reason:
          'The viewer sees what actually arrives: loss, decoded size and round-trip time (spec v0.1, AC-8).',
      },
      {
        chose: 'Compute fps and bitrate from counter differences',
        insteadOf: 'Trusting a single report',
        reason:
          '`bytesReceived` only grows, so the rate is the change divided by the time between two reads.',
      },
      {
        chose: 'Send stats to the host every second tick',
        insteadOf: 'Every tick',
        reason:
          'The host window does not need a one-second beat, and the control channel stays quiet.',
      },
      {
        chose: 'Validate the stats message in the protocol parser',
        insteadOf: 'Validating it in the host window',
        reason: 'All network input is parsed in one place (CLAUDE.md, code rules).',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '006', note: 'gave us the receiver and the toolbar' },
      { spec: '007', note: 'gave us the host window to show the numbers' },
    ],
    unlocks: [
      { spec: '012', note: 'the low-bandwidth preset needs these numbers to show it helped' },
      { spec: '015', note: 'quality presets use them to show whether a change worked' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Poll once a second',
        explanation: 'Every second the viewer calls `receiver.stats()`.',
      },
      {
        title: 'Find the reports',
        explanation:
          'The receiver finds the inbound video report, the selected candidate pair and the codec report, and reads the counters.',
      },
      {
        title: 'Turn counters into rates',
        explanation:
          "It subtracts the previous reading to get fps and kbps, and uses the candidate pair's round-trip time as latency.",
      },
      {
        title: 'Show six values',
        explanation:
          'The page writes the six values into the overlay. The "Stats" button toggles it and the choice is remembered.',
      },
      {
        title: 'Tell the host',
        explanation:
          'Every second tick the viewer also sends a `stats` message. The host checks the sender is the active viewer and shows the numbers in its window.',
      },
    ],
  },

  code: [
    {
      file: 'apps/viewer/src/receiver.ts',
      excerpt: `    let kbps = 0;
    let fps = num(inb.framesPerSecond);
    if (this.prev) {
      const secs = (now - this.prev.at) / 1000;
      if (secs > 0) {
        kbps = ((bytes - this.prev.bytes) * 8) / 1000 / secs;
        if (!fps) fps = (frames - this.prev.frames) / secs;
      }
    }
    this.prev = { bytes, frames, at: now };`,
      explanation:
        'A rate is a difference. Keep the last reading, subtract it from the new one and divide by the time between them. The first call has nothing to subtract, so it reports 0.',
    },
    {
      file: 'apps/viewer/src/main.ts',
      excerpt: `function startStats(): void {
  stopStats();
  statsTick = 0;
  statsTimer = window.setInterval(async () => {
    const s = await receiver.stats().catch(() => null);
    if (!s) return;
    statsTick += 1;
    $('s-rtt').textContent = s.rttMs === null ? '-' : \`\${Math.round(s.rttMs)} ms\`;
    $('s-fps').textContent = String(Math.round(s.fps));
    $('s-kbps').textContent = \`\${(s.kbps / 1000).toFixed(1)} Mbps\`;
    $('s-size').textContent = s.width ? \`\${s.width}×\${s.height}\` : '-';
    $('s-codec').textContent = s.codec;
    $('s-loss').textContent = \`\${s.lossPct.toFixed(1)}%\`;
    if (statsTick % 2 === 0) socket.send({ type: 'stats', stats: s });
  }, 1000);
}`,
      explanation:
        'One timer drives both the overlay and the report to the host. A failed read is skipped, never thrown, and `statsTick % 2` halves the traffic to the host.',
    },
  ],

  concepts: [
    {
      name: 'WebRTC statistics',
      level: 'Core',
      explanation:
        '`getStats()` returns a map of reports. The inbound video report holds counters like `bytesReceived` and `framesDecoded`, which only ever grow.',
      resources: [
        {
          title: 'MDN: RTCPeerConnection.getStats',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats',
        },
        {
          title: 'MDN: RTCInboundRtpStreamStats',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCInboundRtpStreamStats',
        },
      ],
    },
    {
      name: 'Rates from counters',
      level: 'Pattern',
      explanation:
        'Monotonic counters become rates by keeping the previous reading and dividing the change by the elapsed time.',
      resources: [
        {
          title: 'MDN: Performance.now',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Performance/now',
        },
      ],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why is the first reading after a connection missing a bitrate?',
      answer:
        'The bitrate is a difference between two readings. With no previous reading there is nothing to subtract, so it starts at 0 until the next tick.',
    },
    {
      question: 'Why is latency `null` in some readings?',
      answer:
        'The round-trip time lives on the selected candidate pair. Until a pair is selected, or if the browser does not report it, the value is missing and the page shows a dash.',
    },
    {
      question: 'Why does the host reject `stats` from a viewer that is not active?',
      answer:
        'A viewer that was refused as busy or has not paired should never change what the host shows, so the session ignores its messages.',
    },
  ],

  commits: [],
  commitsNote:
    'No commits of its own. The overlay was built as part of the viewer and host window work in specs 006 and 007.',
});
