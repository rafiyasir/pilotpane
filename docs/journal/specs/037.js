window.JOURNAL.push({
  number: '037',
  title: 'Automatic codec',
  version: 'v0.4',
  mergedDate: '2026-10-29',
  technologies: ['WebRTC codecs', 'SDP', 'Media Capabilities API', 'RTCRtpTransceiver'],
  oneLine: 'The viewer picks the video codec that suits its own machine, so an old laptop is not stuck with VP8.',

  what: {
    summary:
      'Spec 031 made VP8 the first codec the host offers. That is sharp on a modern viewer, but a Windows 8 laptop with Chrome 109 may decode VP8 in software and stutter at 1080p. Only the viewer knows its own decoder, so the viewer now decides. It reads the codecs in the host offer, asks `navigator.mediaCapabilities` whether VP8 and H.264 decode 1080p at 30 fps smoothly, and reorders its codec preferences before it answers. VP8 stays first only when the browser says it is smooth. Otherwise H.264 goes first, and the same happens when the browser cannot say. The host and the network protocol are untouched.',
    partsTouched: [
      {
        path: 'packages/protocol/src/sdp.ts',
        note: 'New `offeredCodecs(sdp)`: the video codec families in an offer, in payload order, ignoring rtx, red, ulpfec and audio',
        changed: true
      },
      {
        path: 'packages/protocol/src/codec-choice.ts',
        note: 'New and pure: `chooseCodec` decides the order, `codecFamily` turns a mime type into a family. Unit tested',
        changed: true
      },
      {
        path: 'apps/viewer/src/codec-probe.ts',
        note: 'New: asks `mediaCapabilities.decodingInfo` with a 1 s timeout. The probe is injectable, and any failure means "unknown"',
        changed: true
      },
      {
        path: 'apps/viewer/src/receiver.ts',
        note: '`preferCodecs` applies the order with `setCodecPreferences` before `createAnswer`',
        changed: true
      },
      { path: 'docs/DECISIONS.md and docs/ARCHITECTURE.md', note: 'ADR-020 and the codec line in the Video section', changed: true },
      { path: 'apps/host', note: 'Untouched: it still offers VP8 first, then H.264 (ADR-019)', changed: false },
      { path: 'packages/protocol messages', note: 'No new message, `PROTOCOL_VERSION` stays 3', changed: false }
    ]
  },

  why: {
    decisions: [
      {
        chose: 'The viewer decides, from what its own browser reports',
        insteadOf: 'The host guessing, or one fixed default for everyone',
        reason:
          'The host cannot see the viewer decoder. The answer SDP already carries the viewer choice, so no new message is needed and old and new hosts behave the same.'
      },
      {
        chose: 'H.264 first whenever the browser cannot say',
        insteadOf: 'Keeping VP8 first when the answer is unknown',
        reason:
          'A wrong guess toward VP8 can leave an old laptop choppy, while a wrong guess toward H.264 only costs a little sharpness in motion. Old machines also more often have a hardware H.264 decoder.'
      },
      {
        chose: 'Reorder codecs the browser already has',
        insteadOf: 'Our own codec, WebCodecs or a WebAssembly decoder',
        reason:
          'WebRTC only negotiates built-in codecs. WebCodecs needs a secure context and the viewer is plain HTTP. A WebAssembly decoder would break the no-dependency rule. VP9, AV1 and H.265 stay at the end of the list so negotiation still works.'
      },
      {
        chose: 'A pure `chooseCodec` and an injected probe',
        insteadOf: 'Putting the decision inside `receiver.ts`',
        reason:
          'The rule is plain data in, data out, so `node --test` covers every case. The browser call is the only part that needs a browser, and it sits behind a small function type.'
      }
    ]
  },

  when: {
    dependsOn: [
      { spec: '005', note: 'the WebRTC offer and answer between host and viewer' },
      { spec: '031', note: 'VP8 first on the host (ADR-019), which this spec protects old viewers from' }
    ],
    unlocks: [{ spec: '038', note: 'a manual Codec select in the toolbar, which can reuse the same ordering code' }]
  },

  how: {
    steps: [
      {
        title: 'The host offers as before',
        explanation:
          'The offer lists VP8 first, then H.264, then the rest. Nothing on the host changes.'
      },
      {
        title: 'The viewer reads the offer',
        explanation:
          '`offeredCodecs` walks the `m=video` line for the payload order and the `a=rtpmap` lines for the names, and returns each family once. Retransmission, red and FEC payloads are not codecs the user cares about, so they are skipped.'
      },
      {
        title: 'The viewer asks the browser',
        explanation:
          '`probeCodecs` calls `mediaCapabilities.decodingInfo` for 1080p at 30 fps, once for VP8 and once for H.264, in parallel. Each call has a 1 s timeout. A missing API, an error or a timeout gives `null`, meaning unknown.'
      },
      {
        title: 'The order is chosen',
        explanation:
          '`chooseCodec` puts VP8 first only if it is offered and reported smooth. Otherwise H.264 goes first unless it is known to fail. Everything else keeps the offer order.'
      },
      {
        title: 'The preferences are applied before the answer',
        explanation:
          '`setCodecPreferences` takes the browser receive capabilities sorted by that order. Codecs that are not in the list, such as rtx, go last. The answer is then created, so it lists the chosen codec first. The result is logged as `codec order` in the console.'
      },
      {
        title: 'Anything that fails is harmless',
        explanation:
          'If any step throws, the browser keeps its default order and the stream still plays. This was checked by hiding `mediaCapabilities` on the viewer.'
      }
    ]
  },

  code: [
    {
      file: 'packages/protocol/src/codec-choice.ts',
      excerpt: `export function chooseCodec(offered: readonly string[], capabilities: CodecCapabilities): string[] {
  const first =
    offered.includes('vp8') && capabilities['vp8'] === true
      ? 'vp8'
      : offered.includes('h264') && capabilities['h264'] !== false
        ? 'h264'
        : undefined;
  return first ? [first, ...offered.filter((c) => c !== first)] : [...offered];
}`,
      explanation:
        'The whole decision. Only an explicit "smooth" lets VP8 lead. A `null` or a missing entry is not `true`, so unknown falls through to H.264.'
    },
    {
      file: 'packages/protocol/src/sdp.ts',
      excerpt: `  const out: string[] = [];
  for (const pt of order) {
    const family = FAMILY_BY_NAME[names.get(pt) ?? ''];
    if (family && !out.includes(family)) out.push(family);
  }
  return out;`,
      explanation:
        'The order comes from the `m=video` payload list, and the lookup table drops anything that is not a real codec family. A second H.264 profile does not repeat the family.'
    },
    {
      file: 'apps/viewer/src/codec-probe.ts',
      excerpt: `  const safe = (family: string): Promise<boolean | null> =>
    Promise.race([
      probe(family).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]);
  const [vp8, h264] = await Promise.all([safe('vp8'), safe('h264')]);`,
      explanation:
        'A slow or broken browser call can never hold up pairing: the race gives up after the timeout and reports "unknown".'
    },
    {
      file: 'apps/viewer/src/receiver.ts',
      excerpt: `      const rank = (c: RTCRtpCodec): number => {
        const i = order.indexOf(codecFamily(c.mimeType));
        return i === -1 ? order.length : i; // rtx, red, fec and unlisted codecs stay last
      };
      const sorted = caps.codecs.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i);
      transceiver.setCodecPreferences(sorted.map((x) => x.c));`,
      explanation:
        'The browser list is sorted by family rank, with the original index as a tie-breaker so the sort is stable on every engine.'
    }
  ],

  concepts: [
    {
      name: 'SDP offer and answer',
      level: 'Core',
      explanation:
        'WebRTC peers agree on media by exchanging text descriptions. The offer lists payload types and their codecs; the answer keeps the ones the answerer wants, in its own order of preference. That is why the viewer can choose without the host knowing.',
      resources: [
        {
          title: 'MDN: Session Description Protocol',
          url: 'https://developer.mozilla.org/en-US/docs/Glossary/SDP'
        },
        { title: 'RFC 8829: JSEP, JavaScript Session Establishment Protocol', url: 'https://www.rfc-editor.org/rfc/rfc8829' }
      ]
    },
    {
      name: 'setCodecPreferences',
      level: 'Core',
      explanation:
        'A transceiver can be told which codecs to use and in what order. It must be called before the answer is created, and the list can only contain codecs from the browser capabilities.',
      resources: [
        {
          title: 'MDN: RTCRtpTransceiver.setCodecPreferences()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/setCodecPreferences'
        },
        {
          title: 'MDN: RTCRtpReceiver.getCapabilities()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpReceiver/getCapabilities_static'
        }
      ]
    },
    {
      name: 'Media Capabilities API',
      level: 'Concept',
      explanation:
        '`decodingInfo` tells you whether a configuration is `supported`, `smooth` and `powerEfficient`. For `type: "webrtc"` it describes real-time decoding. It can be missing or incomplete on older browsers, so the answer is treated as a hint.',
      resources: [
        {
          title: 'MDN: MediaCapabilities.decodingInfo()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/MediaCapabilities/decodingInfo'
        },
        { title: 'W3C: Media Capabilities', url: 'https://www.w3.org/TR/media-capabilities/' }
      ]
    },
    {
      name: 'Fail toward the safe choice',
      level: 'Pattern',
      explanation:
        'When a check cannot answer, pick the option whose worst case is mild. Here, unknown means H.264. A timeout wraps every external call so the check never blocks the main flow.',
      resources: [
        {
          title: 'MDN: Promise.race()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race'
        }
      ]
    }
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why does the viewer choose the codec and not the host?',
      answer:
        'Only the viewer knows what its own decoder handles smoothly. The viewer answer already carries its order of preference, so no new message is needed.'
    },
    {
      question: 'What happens when `navigator.mediaCapabilities` is missing or slow?',
      answer:
        'The probe returns unknown after at most 1 s, `chooseCodec` puts H.264 first, and the stream plays. The safe choice costs a little sharpness, not smoothness.'
    },
    {
      question: 'Why are rtx and red kept in the list passed to `setCodecPreferences`?',
      answer:
        'They support the real codecs (retransmission and loss recovery). Dropping them would weaken the stream, so they are sorted last instead.'
    },
    {
      question: 'Why is `chooseCodec` in `packages/protocol` and not in the viewer?',
      answer:
        'It is pure logic with no browser types, so `node --test` can check every case. The viewer only supplies the probe and applies the result.'
    }
  ],

  commitsNote:
    'The commits for this spec are added when the branch is prepared for the pull request. Use the Commits button once the spec-037-done tag exists.'
});
