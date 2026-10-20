window.JOURNAL.push({
  number: '006',
  title: 'Viewer page for Chrome 109',
  version: 'v0.1',
  mergedDate: '2026-10-21',
  technologies: ['WebSocket API', 'RTCPeerConnection', 'ES2020', 'CSS custom properties', 'Fullscreen API'],
  oneLine:
    "An old laptop can open a web address, type a PIN and watch the host's screen, with nothing installed and a reconnect that keeps the last frame.",

  what: {
    summary:
      'A small web app with no bundler: a socket wrapper, a WebRTC receiver and a page controller. It compiles to ES2020 and uses only what Chrome 109 has, with fallbacks where plain HTTP hides an API.',
    partsTouched: [
      {
        path: 'apps/viewer',
        note: '`socket.ts`, `receiver.ts`, `main.ts`, `index.html`, `viewer.css`, `theme.css` and the ES2020 build',
        changed: true,
      },
      {
        path: 'packages/protocol',
        note: 'Provides the parser, `pinProof` and the types',
        changed: false,
      },
      {
        path: 'apps/host',
        note: '`net/http-server.ts` serves the viewer folder',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Plain HTTP with fallbacks',
        insteadOf: 'Requiring HTTPS',
        reason:
          'Old browsers show certificate warnings and nothing may be installed on the viewer. `window.isSecureContext` is checked before any secure-only API (ADR-004).',
      },
      {
        chose: 'No bundler and no framework',
        insteadOf: 'A typical front-end stack',
        reason:
          'The page is small, Chrome 109 runs ES2020 as is, and the dependency policy forbids extra packages (ADR-002).',
      },
      {
        chose: 'Close the peer connection but keep the `<video>` element',
        insteadOf: 'Clearing the picture',
        reason: 'The last frame stays on screen while the viewer reconnects.',
      },
      {
        chose: 'Guard `localStorage` and `sessionStorage` with try and catch',
        insteadOf: 'Assuming storage works',
        reason: 'Storage can throw in private windows.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '002', note: 'gave us the parser and `pinProof`' },
      { spec: '004', note: 'defined the pairing rules and resume tokens' },
      { spec: '005', note: 'sends the offer this page answers' },
    ],
    unlocks: [
      { spec: '007', note: 'shows the same session on the host side' },
      { spec: '008', note: 'adds the numbers overlay on this page' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Open the socket',
        explanation:
          'The page opens a WebSocket to `ws://` plus the address it was served from, and waits for `hello`.',
      },
      {
        title: 'Prove the PIN',
        explanation:
          'The user types six digits. The page computes `pinProof(nonce, pin)` and sends `pair`. The PIN itself is never sent.',
      },
      {
        title: 'Keep the token',
        explanation:
          'On success the page stores the token in `sessionStorage`, and the host sends an offer.',
      },
      {
        title: 'Answer and show video',
        explanation:
          '`Receiver.handleOffer` answers it, shows the stream in the video element and reports when the connection is up.',
      },
      {
        title: 'Reconnect quietly',
        explanation:
          'If the socket drops, the page keeps the last frame, shows "Reconnecting", and sends `resume` with the token. If the token no longer works, it asks for the PIN.',
      },
    ],
  },

  code: [
    {
      file: 'apps/viewer/src/socket.ts',
      excerpt: `  connect(): void {
    this.dispose();
    const ws = new WebSocket(\`ws://\${location.host}\${WS_PATH}\`);
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.handlers.onOpen();
    };
    ws.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      const msg = parseHostMessage(e.data);
      if (msg) this.handlers.onMessage(msg);
      else console.warn('[pilotpane] ignored a bad message from the host');
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.handlers.onClose(opened);
    };
    this.ws = ws;
  }`,
      explanation:
        'Every incoming frame goes through `parseHostMessage`, so the page never touches raw JSON. The `opened` flag lets the caller tell "never connected" from "connected, then dropped".',
    },
  ],

  concepts: [
    {
      name: 'WebSocket in the browser',
      level: 'Core',
      explanation:
        'A persistent two-way connection with `onopen`, `onmessage` and `onclose` callbacks.',
      resources: [
        {
          title: 'MDN: WebSocket',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebSocket',
        },
      ],
    },
    {
      name: 'Secure contexts',
      level: 'Core',
      explanation:
        'Which APIs disappear on plain HTTP, and why every one of them needs a fallback here.',
      resources: [
        {
          title: 'MDN: Secure contexts',
          url: 'https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts',
        },
      ],
    },
    {
      name: 'Receiving video with WebRTC',
      level: 'Core',
      explanation:
        'The viewer answers the host\'s offer and attaches the incoming stream to a `<video>` element.',
      resources: [
        {
          title: 'MDN: RTCPeerConnection',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection',
        },
      ],
    },
    {
      name: 'Fullscreen API',
      level: 'Concept',
      explanation: 'Lets the stream fill the screen from a button press.',
      resources: [
        {
          title: 'MDN: Fullscreen API',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API',
        },
      ],
    },
    {
      name: 'CSS custom properties',
      level: 'Pattern',
      explanation:
        'Each theme is a block of variables on `data-theme`. Switching theme changes one attribute and every colour follows.',
      resources: [
        {
          title: 'MDN: Using CSS custom properties',
          url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties',
        },
      ],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why does `dispose()` clear the handlers before closing the socket?',
      answer:
        'Otherwise `onclose` would fire and the page would start a reconnect that nobody asked for, for example after the user pressed Disconnect.',
    },
    {
      question: 'What does `onClose(wasOpen)` let the page tell apart?',
      answer:
        'A connection that never opened (host unreachable) from one that opened and then dropped (network blip), which need different messages.',
    },
    {
      question: 'Why does the page use `sessionStorage` for the resume token?',
      answer:
        'The token should live only as long as the tab. Closing the tab forgets it and the next visit asks for the PIN again.',
    },
  ],

  commits: [
    'chore(viewer): add viewer package manifest and tsconfig',
    'feat(viewer): add websocket client with reconnect',
    'feat(viewer): add webrtc receiver',
    'feat(viewer): add page markup and styles',
    'feat(viewer): add pin entry and stream view logic',
  ],
});
