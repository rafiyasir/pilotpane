window.JOURNAL.push({
  number: '031',
  title: 'Performance and sharpness',
  version: 'v0.4',
  mergedDate: '2026-10-29',
  technologies: ['WebRTC codecs', 'contentHint', 'RTCRtpSender', 'Electron'],
  oneLine:
    'Scrolling stays sharp and smooth, and a host that is short of CPU steps the stream down instead of stalling.',

  what: {
    summary:
      'Real use found three things: lag that seemed to grow, lag when the host was busy, and a whole screen that smeared for seconds while scrolling and went sharp again when it stopped. Nothing was measured, so this spec measured first. The debug log now shows the encoder, whether it is hardware, how long the CPU limited it, the load level and free RAM. The numbers showed the host never ran out of CPU, the network round trip was 8 ms, and the viewer decoded in hardware. The smear came from the AMD hardware H.264 encoder, which used about 6 Mbps of an 11 Mbps target. The fix is a codec choice, not a setting: the host now offers VP8 first and sets `contentHint` to `detail`. A small governor also steps the stream down when the encoder reports that the CPU is the limit.',
    partsTouched: [
      {
        path: 'apps/host/src/renderer/engine/engine.ts',
        note: '`preferCodecs` (VP8, then H.264), `contentHint = detail`, the load ceiling in `applyQuality`, more fields in the debug stats',
        changed: true
      },
      {
        path: 'apps/host/src/main/host-load.ts',
        note: 'New `HostLoadGovernor`: steps a load level down after about 5 s of CPU limit and back up after 30 s, with tests',
        changed: true
      },
      {
        path: 'apps/host/src/main/controller.ts',
        note: 'Feeds the governor from the debug stats, sends `load-level` to the engine, logs free RAM',
        changed: true
      },
      {
        path: 'packages/protocol/src/host-internal.ts',
        note: 'Internal types only: `load-level` command and three more debug-stats fields. No network message, so `PROTOCOL_VERSION` stays 3',
        changed: true
      },
      { path: 'docs/DECISIONS.md and docs/ARCHITECTURE.md', note: 'ADR-018, ADR-019 and the Video section', changed: true },
      { path: 'apps/viewer', note: 'Untouched: the viewer decodes whichever codec the answer picks', changed: false },
      { path: 'apps/host/src/main/net, pairing.ts', note: 'Untouched', changed: false }
    ]
  },

  why: {
    decisions: [
      {
        chose: 'Measure first, then keep only what the numbers support',
        insteadOf: 'Building a viewer catch-up and raising the 1080p bitrate to 20 Mbps up front',
        reason:
          'Both were guesses. The viewer cannot seek a live stream, so a catch-up only re-applies a hint it already set. And the encoder used 6 to 7 Mbps of an 11 Mbps target, so a higher ceiling could not help. Both were removed or reverted.'
      },
      {
        chose: 'VP8 first with `contentHint = detail`',
        insteadOf: 'Hardware H.264 with `motion` (ADR-016), or VP9',
        reason:
          'The hardware encoder spent too few bits on a full-screen scroll. Software VP9 was sharp but choppy at 1080p. Software VP8 gave 30 to 56 fps, about 7% CPU on average, and no CPU limit. The codec order is one function, so it is easy to change.'
      },
      {
        chose: 'A private load ceiling inside the engine',
        insteadOf: 'Changing the viewer preset from the host, or a new network message',
        reason:
          'No protocol change, and it cannot fight the viewer Auto, which works below the ceiling. It only acts on machines that fall back to a software encoder or run short of CPU.'
      },
      {
        chose: 'Keep `detail` fixed',
        insteadOf: 'Switching between `motion` and `text` by watching the sent frame rate',
        reason:
          'It is circular: `text` lowers the frame rate that would show you started scrolling again, so the switch could never switch back.'
      },
      {
        chose: 'Only choose among codecs the platform already provides',
        insteadOf: 'Writing or porting a codec of our own',
        reason:
          'WebRTC only negotiates codecs the browser has built in. WebCodecs needs a secure context and the viewer is plain HTTP, and a WebAssembly codec would break the no-dependency rule and the transport that WebRTC gives for free.'
      }
    ]
  },

  when: {
    dependsOn: [
      { spec: '005', note: 'capture, the send-only peer connection and the codec preference' },
      { spec: '015', note: 'quality presets and the stats the viewer already measures' }
    ],
    unlocks: [
      { spec: '037', note: 'the viewer picks VP8 or H.264 for its own machine, so old viewers stay smooth' },
      { spec: '038', note: 'a Codec select in the toolbar, once the screen is designed' }
    ]
  },

  how: {
    steps: [
      {
        title: 'The engine reports what the encoder is doing',
        explanation:
          'Every 5 seconds it reads the `outbound-rtp` stats of the video sender and sends the frame width, fps, target bitrate, `qualityLimitationReason`, the encoder name, a hardware flag and CPU-limited seconds to the main process.'
      },
      {
        title: 'The controller logs and feeds the governor',
        explanation:
          'With `PILOTPANE_LOG=debug` each report becomes one `send:` line, with the load level and free RAM at the end. The same reason string goes to `HostLoadGovernor`.'
      },
      {
        title: 'The governor decides',
        explanation:
          'It tracks since when the reason has been `cpu` and since when it has not. After about 5 s of `cpu` it moves one level down, after 30 s without it one level up, and never more than once per 15 s.'
      },
      {
        title: 'The engine applies the ceiling',
        explanation:
          'A new `load-level` command sets a cap on top of the viewer preset: 60, 30, then 20 fps, and 720p at the last level. A new stream always starts at level 0.'
      },
      {
        title: 'The offer is built with VP8 first',
        explanation:
          'When a stream starts, `preferCodecs` puts VP8 first and H.264 second, and `contentHint = detail` tells the encoder that sharp text matters more than smooth frames. The viewer answer picks from that list.'
      },
      {
        title: 'The test loop was the real work',
        explanation:
          'Each idea was tried on two laptops, one change at a time, with the host log, the viewer `webrtc-internals` graphs and a viewer-side screenshot. That is how the hardware encoder was found, and how three guesses were ruled out.'
      }
    ]
  },

  code: [
    {
      file: 'apps/host/src/main/host-load.ts',
      excerpt: `  /** Feed the encoder's \`qualityLimitationReason\`. Returns the new level when it changed, else null. */
  sample(reason: string): LoadLevel | null {
    const t = this.now();
    const limited = reason === 'cpu';
    this.limitedSince = limited ? (this.limitedSince ?? t) : null;
    this.freeSince = limited ? null : (this.freeSince ?? t);
    if (t - this.changedAt < LOAD_MIN_GAP_MS) return null;

    if (this.limitedSince !== null && t - this.limitedSince >= LOAD_DOWN_AFTER_MS && this.current < MAX_LOAD_LEVEL) {
      return this.move((this.current + 1) as LoadLevel, t);
    }
    if (this.freeSince !== null && t - this.freeSince >= LOAD_UP_AFTER_MS && this.current > 0) {
      return this.move((this.current - 1) as LoadLevel, t);
    }
    return null;
  }`,
      explanation:
        'The whole decision. A run of "limited" and a run of "free" are tracked separately, and a minimum gap stops the picture from flapping. The clock is injected, so tests never wait.'
    },
    {
      file: 'apps/host/src/renderer/engine/engine.ts',
      excerpt: `function preferCodecs(transceiver: RTCRtpTransceiver): void {
  const caps = RTCRtpSender.getCapabilities('video');
  if (!caps) return;
  const rank = (c: RTCRtpCodec): number => {
    const mime = c.mimeType.toLowerCase();
    return mime === 'video/vp8' ? 0 : mime === 'video/h264' ? 1 : 2;
  };
  transceiver.setCodecPreferences([...caps.codecs].sort((a, b) => rank(a) - rank(b)));
}`,
      explanation:
        'The codec choice, in one place. It does not write a codec: it only orders the ones the browser already offers.'
    },
    {
      file: 'apps/host/src/renderer/engine/engine.ts',
      excerpt: `  // 'detail' keeps text sharp while scrolling. 'motion' (ADR-016) favoured smooth frames and left
  // scrolling blurry; 'text' sent too few frames (ADR-019). Resolution is also kept by degradationPreference.
  track.contentHint = 'detail';`,
      explanation: 'The hint that tells the encoder what the content is. It is the other half of the sharpness fix.'
    },
    {
      file: 'apps/host/src/renderer/engine/engine.ts',
      excerpt: `  const height = Math.min(spec.height, LOAD_MAX_HEIGHT[loadLevel]);
  const params = sender.getParameters();
  if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
  const enc = params.encodings[0]!;
  enc.scaleResolutionDownBy = Math.max(1, capturedHeight / height);
  enc.maxBitrate = spec.maxBitrate;
  enc.maxFramerate = Math.min(spec.maxFramerate, LOAD_MAX_FPS[loadLevel]);`,
      explanation:
        'The ceiling sits on top of the preset: the smaller of the preset and the load level wins, so the viewer choice and the host load never fight.'
    },
    {
      file: 'apps/host/src/main/controller.ts',
      excerpt: `  private stepLoad(reason: string): void {
    const level = this.load.sample(reason);
    if (level === null) return;
    log.info(\`host is busy: stream load level \${level}\`);
    this.engine({ cmd: 'load-level', level });
  }`,
      explanation: 'The only wiring: a changed level becomes one command to the engine, and one line in the log.'
    }
  ],

  concepts: [
    {
      name: 'WebRTC codec negotiation',
      level: 'Core',
      explanation:
        'The host offers a list of codecs in the SDP and the viewer answers with the ones it can use. `setCodecPreferences` changes the order of that list. Browsers must support both VP8 and H.264, so those two are always a safe pair.',
      resources: [
        {
          title: 'MDN: RTCRtpTransceiver.setCodecPreferences()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/setCodecPreferences'
        },
        { title: 'MDN: Codecs used by WebRTC', url: 'https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/WebRTC_codecs' },
        { title: 'RFC 7742: WebRTC Video Processing and Codec Requirements', url: 'https://www.rfc-editor.org/rfc/rfc7742' }
      ]
    },
    {
      name: 'Hardware and software encoders',
      level: 'Concept',
      explanation:
        'A codec is a method. An encoder is an implementation of it. Software encoders ship inside the browser or Electron and look the same on every OS. Hardware encoders come from the GPU driver through the OS, cost almost no CPU, but make their own choices about how many bits to spend. That is what smeared the scroll here.',
      resources: [
        { title: 'MDN: Web video codec guide', url: 'https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs' },
        {
          title: 'MDN: RTCOutboundRtpStreamStats.encoderImplementation',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCOutboundRtpStreamStats/encoderImplementation'
        }
      ]
    },
    {
      name: 'Content hints',
      level: 'Concept',
      explanation:
        'A video track can say what it carries: `motion` favours smooth frames, `detail` and `text` favour sharp pictures. The encoder uses it to decide what to give up when bits run short.',
      resources: [
        {
          title: 'MDN: MediaStreamTrack.contentHint',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/contentHint'
        },
        { title: 'W3C: MediaStreamTrack Content Hints', url: 'https://www.w3.org/TR/mst-content-hint/' }
      ]
    },
    {
      name: 'WebRTC statistics',
      level: 'Concept',
      explanation:
        '`getStats()` reports what the sender and receiver are really doing: frames per second, target bitrate, why quality was limited (`cpu`, `bandwidth`, `none`). Reading these first turned guesses into measurements.',
      resources: [
        { title: 'W3C: Identifiers for WebRTC Statistics', url: 'https://www.w3.org/TR/webrtc-stats/' },
        {
          title: 'MDN: RTCOutboundRtpStreamStats.qualityLimitationReason',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCOutboundRtpStreamStats/qualityLimitationReason'
        }
      ]
    },
    {
      name: 'Hysteresis with an injected clock',
      level: 'Pattern',
      explanation:
        'Step down fast, step up slowly, and never change more than once per interval, so the picture does not flap. Taking the clock as a constructor argument lets a test move time by hand.',
      resources: [{ title: 'Node.js: Test runner', url: 'https://nodejs.org/api/test.html' }]
    }
  ],

  bugs: [
    {
      symptom:
        'While scrolling, the whole moving area smeared into blocks for some seconds and went sharp again when scrolling stopped.',
      cause:
        'The AMD hardware H.264 encoder spent too few bits on a full-screen change: about 6 to 7 Mbps of an 11 Mbps target. The picture size stayed 1920 by 1080, so it was the encoder quality, not scaling. A higher bitrate ceiling, a different capture path and a VP8 swap with the `motion` hint changed nothing.',
      fix: 'The host now offers VP8 first and sets `contentHint` to `detail`. A viewer-side screenshot was used to see the smear, because a phone video could not separate camera blur from encoder blur.'
    },
    {
      symptom: 'With software VP9 the blur was gone, but scrolling was choppy and typing lagged.',
      cause: 'VP9 is much heavier to encode than VP8 at 1080p, so frames came out late.',
      fix: 'VP8 instead of VP9. It kept the sharpness and gave 30 to 56 fps with about 7% host CPU.'
    },
    {
      symptom:
        'Typing felt delayed after heavy scrolling, and slightly delayed after a few idle minutes while other heavy apps were running.',
      cause:
        'Not fully explained. The round trip was 8 ms, decoding took 1 to 3 ms and the CPU limit never triggered, so it was neither the network nor the decoder. The idle lag happened at 94% RAM with heavy apps on purpose, which most likely means Windows paging idle processes back in. Typing sends few frames, which makes any frame delay visible.',
      fix: 'Typing felt a little better with VP8. Free RAM is now in the debug log so the next measurement can check paging. The Windows 8 viewer and a 30 minute session are still to be checked.'
    }
  ],

  quiz: [
    {
      question: 'Why was raising the 1080p bitrate ceiling to 20 Mbps useless?',
      answer:
        'The encoder was using only 6 to 7 Mbps of an 11 Mbps target. The limit was how many bits the hardware encoder chose to spend, not the ceiling.'
    },
    {
      question: 'Why does the host not tell the viewer when it steps the stream down?',
      answer:
        'The ceiling is private inside the engine and sits on top of the viewer preset, so no new message is needed and it cannot fight the viewer Auto. The viewer sees the real fps and size in its stats.'
    },
    {
      question: 'Why can `contentHint` not switch between `text` and `motion` by watching the frame rate?',
      answer:
        '`text` lowers the frame rate, so the signal that would show you started scrolling again is the one the hint suppresses. It could never switch back.'
    },
    {
      question: 'Why do we not write our own codec?',
      answer:
        'WebRTC only negotiates codecs the browser has built in, WebCodecs needs a secure context, and a WebAssembly codec would add a dependency and lose WebRTC transport. We only choose the order of the platform codecs.'
    }
  ],

  commitsNote:
    'The commits for this spec are added when the branch is prepared for the pull request. Use the Commits button once the spec-031-done tag exists.'
});
