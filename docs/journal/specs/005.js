window.JOURNAL.push({
  number: '005',
  title: 'Screen capture and WebRTC',
  version: 'v0.1',
  mergedDate: '2026-10-21',
  technologies: ['Electron', 'desktopCapturer', 'WebRTC', 'H.264', 'contextBridge', 'Process sandbox'],
  oneLine:
    'The host can now capture the primary screen and send it to a paired viewer as live H.264 video over WebRTC.',

  what: {
    summary:
      "A hidden Chromium page captures the screen and sends it over a WebRTC peer connection. The main process wires pairing, session and engine together, and every window runs sandboxed with a small typed bridge.",
    partsTouched: [
      {
        path: 'apps/host/src/renderer/engine',
        note: '`engine.ts` captures the screen, makes the offer and applies quality presets; `engine.html` loads it',
        changed: true,
      },
      {
        path: 'apps/host/src/main',
        note: '`controller.ts`, `main.ts`, `windows.ts`, `preload.cts`, `app-protocol.ts` and `settings.ts`',
        changed: true,
      },
      {
        path: 'apps/host/src/main/session.ts',
        note: 'Relays offer, answer and ICE between engine and viewer',
        changed: false,
      },
      { path: 'apps/viewer', note: 'Will answer the offer in 006', changed: false },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Electron (`desktopCapturer` and Chromium WebRTC)',
        insteadOf: 'A native capture plus ffmpeg pipeline',
        reason:
          'Capture, hardware-friendly encoding and WebRTC come built in, and the project stays in TypeScript (ADR-001).',
      },
      {
        chose: 'Switch off `WebRtcHideLocalIpsWithMdns` and use no STUN or TURN',
        insteadOf: 'Chromium\'s default `.local` names',
        reason:
          'On a direct cable or Bluetooth link there may be no working mDNS, and the viewer could never find the host (ADR-008).',
      },
      {
        chose: 'Run capture in a hidden renderer',
        insteadOf: 'The main process',
        reason: 'Capture and WebRTC live in Chromium, not in Node.',
      },
      {
        chose: '`app://bundle` for the host\'s own windows',
        insteadOf: '`file://`',
        reason:
          'A registered secure scheme allows ES modules and media capture and keeps those windows away from the LAN server.',
      },
      {
        chose: '`sandbox` and `contextIsolation` with a typed preload',
        insteadOf: 'Node access in renderers',
        reason: 'A renderer should never be able to touch the system directly.',
      },
    ],
  },

  when: {
    dependsOn: [
      {
        spec: '004',
        note: 'decides when a viewer becomes active, which is when capture starts',
      },
    ],
    unlocks: [
      { spec: '006', note: 'answers the offer in a browser' },
      { spec: '007', note: 'shows host state in windows through the same bridge' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Pick the screen',
        explanation:
          'When a viewer pairs, `controller.ts` asks `desktopCapturer` for the primary screen and tells the engine to `start` with the source id and the quality preset.',
      },
      {
        title: 'Capture and prefer H.264',
        explanation:
          'The engine captures at up to 1920 by 1080 and 30 fps, adds the video track as send-only and moves H.264 to the front of the codec list.',
      },
      {
        title: 'Offer over the WebSocket',
        explanation:
          'It creates an offer and sends it to main. Main sends it to the viewer over the WebSocket. ICE candidates follow the same road in both directions.',
      },
      {
        title: 'Apply the preset',
        explanation:
          'When the answer arrives, the engine scales down from the captured size and caps the bitrate (originally 8 Mbps for 1080p and 4 Mbps for 720p; raised in the sharper-motion fix, see Bugs).',
      },
      {
        title: 'Stay awake',
        explanation:
          'While a viewer is watching, `powerSaveBlocker` keeps the display awake.',
      },
    ],
  },

  code: [
    {
      file: 'apps/host/src/renderer/engine/engine.ts',
      excerpt: `function preferH264(transceiver: RTCRtpTransceiver): void {
  const caps = RTCRtpSender.getCapabilities('video');
  if (!caps) return;
  const isH264 = (c: RTCRtpCodec) => c.mimeType.toLowerCase() === 'video/h264';
  const h264 = caps.codecs.filter(isH264);
  if (h264.length === 0) return;
  transceiver.setCodecPreferences([...h264, ...caps.codecs.filter((c) => !isH264(c))]);
}`,
      explanation:
        'H.264 first, everything else after it. Old laptops decode H.264 in hardware, so the viewer stays smooth. If the list has no H.264, the default order stands.',
    },
    {
      file: 'apps/host/src/renderer/engine/engine.ts',
      excerpt: `  const peer = new RTCPeerConnection({ iceServers: [] }); // LAN only: no STUN, no TURN
  pc = peer;
  const transceiver = peer.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
  sender = transceiver.sender;
  preferH264(transceiver);

  peer.addEventListener('icecandidate', (e) => emit({ evt: 'ice', candidate: e.candidate ? toWire(e.candidate) : null }));
  peer.addEventListener('connectionstatechange', () => emit({ evt: 'connection', state: peer.connectionState }));

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  emit({ evt: 'offer', sdp: peer.localDescription?.sdp ?? offer.sdp ?? '' });`,
      explanation:
        'The whole sender in a few lines. An empty `iceServers` list keeps everything on the LAN, and the engine reports back to main through `emit`, never to the network directly.',
    },
  ],

  concepts: [
    {
      name: 'Desktop capture',
      level: 'Core',
      explanation:
        '`desktopCapturer` lists screens and windows as sources. A source id passed to `getUserMedia` gives a video stream of it.',
      resources: [
        {
          title: 'Electron: desktopCapturer',
          url: 'https://www.electronjs.org/docs/latest/api/desktop-capturer',
        },
      ],
    },
    {
      name: 'Context isolation and the bridge',
      level: 'Core',
      explanation:
        'The preload runs in its own world and exposes a small, typed `window.pilotpane` object. The page cannot reach anything else in Electron or Node.',
      resources: [
        {
          title: 'Electron: contextBridge',
          url: 'https://www.electronjs.org/docs/latest/api/context-bridge',
        },
        {
          title: 'Electron: Process Sandboxing',
          url: 'https://www.electronjs.org/docs/latest/tutorial/sandbox',
        },
      ],
    },
    {
      name: 'Custom protocol schemes',
      level: 'Concept',
      explanation:
        'Registering `app://` as a privileged scheme lets the host serve its own pages with the powers of a secure origin, without a web server.',
      resources: [
        {
          title: 'Electron: protocol',
          url: 'https://www.electronjs.org/docs/latest/api/protocol',
        },
      ],
    },
    {
      name: 'WebRTC peer connections',
      level: 'Core',
      explanation:
        'Two browsers agree on media with an offer and an answer, find a network path with ICE candidates, and then send encrypted video directly to each other.',
      resources: [
        {
          title: 'MDN: RTCPeerConnection',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection',
        },
        { title: 'RFC 8829: JSEP', url: 'https://www.rfc-editor.org/rfc/rfc8829' },
        { title: 'RFC 8445: ICE', url: 'https://www.rfc-editor.org/rfc/rfc8445' },
      ],
    },
    {
      name: 'Codec order and sender parameters',
      level: 'Concept',
      explanation:
        '`setCodecPreferences` sets which codec the offer lists first. `setParameters` caps the bitrate and scales the picture down.',
      resources: [
        {
          title: 'MDN: setCodecPreferences',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/setCodecPreferences',
        },
        {
          title: 'MDN: RTCRtpSender.setParameters',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/setParameters',
        },
      ],
    },
  ],

  bugs: [
    {
      symptom: 'Picture went blurry while scrolling or when a terminal printed a lot, then sharpened (found 2026-10-21 09:32).',
      cause: 'WebRTC starts at a low bitrate and ramps slowly, so bursts of motion were encoded at low quality.',
      fix: 'Added min, start and max bitrate per preset (1080p 3/6/12 Mbps, 720p 1.5/3/6 Mbps). `withBitrateHints` writes them into the viewer answer as `x-google-*-bitrate` fmtp parameters before `setRemoteDescription`. A 5 s debug report (`debug-stats`) shows `qualityLimitationReason` with `PILOTPANE_LOG=debug`.'
    }
  ],

  quiz: [
    {
      question: 'Why does the engine queue commands and run them one at a time?',
      answer:
        'Commands such as `start`, `answer` and `ice` depend on each other. Running them in order stops an `ice` command from arriving before the connection it belongs to is ready.',
    },
    {
      question: 'Why is `iceServers` an empty list?',
      answer:
        'The two laptops share a LAN, so no STUN or TURN server is needed. Using none also keeps the project off the internet.',
    },
    {
      question:
        'What does `degradationPreference = \'maintain-resolution\'` trade away, and why is that right for text?',
      answer:
        'Under pressure the browser drops frames instead of making the picture blurrier. For code and documents, a sharp picture at lower fps reads better than a smooth blurry one.',
    },
  ],

  commits: [
    'feat(host): add capture engine page with webrtc sender',
    'feat(host): add app protocol for renderer pages',
    'feat(host): add preload bridge',
    'feat(host): add settings store',
    'feat(host): add window manager',
    'feat(host): add controller wiring pairing, session and engine',
    'feat(host): add electron entry point',
  ],
});
