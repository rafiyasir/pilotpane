window.JOURNAL.push({
  number: '011',
  title: 'Mouse events and pointer lock',
  version: 'v0.2',
  mergedDate: '2026-10-23',
  technologies: ['WebRTC data channel', 'Pointer Lock API', 'Wheel events', 'Rate limiting', 'node:test'],
  oneLine:
    'The old laptop is now a mouse as well as a screen: move, click and scroll on the viewer and the host follows.',

  what: {
    summary:
      'Clicking the picture on the viewer takes control. The pointer locks inside the picture, and every move, click and wheel turn is sent over an encrypted WebRTC data channel to the host, which hands it to the input helper from the last spec. Esc lets go. A small hint, badge and outline tell you whether you are viewing or controlling, and the viewer says so when the host cannot take input.',
    partsTouched: [
      {
        path: 'packages/protocol/src/input.ts',
        note: 'The three mouse messages and `parseInputMessage`',
        changed: true,
      },
      {
        path: 'packages/protocol/src/pointer-map.ts',
        note: 'Pure maths: where the picture is inside the video, pointer to host position, wheel to notches',
        changed: true,
      },
      {
        path: 'packages/protocol/src/messages.ts',
        note: 'New host message `input-state` (can the host take input?)',
        changed: true,
      },
      {
        path: 'apps/host/src/main/input-bridge.ts',
        note: 'Turns messages into commands, thins out floods of moves, releases held buttons',
        changed: true,
      },
      {
        path: 'apps/host/src/renderer/engine/engine.ts',
        note: 'Opens the `input` data channel next to the video',
        changed: true,
      },
      {
        path: 'apps/host/src/main/platform',
        note: '`InputInjector` gained `available` and `releaseAll()`',
        changed: true,
      },
      {
        path: 'apps/viewer/src',
        note: '`pointer.ts` (the mouse), `control.ts` (hint, badge, outline), and the receiver now exposes the channel',
        changed: true,
      },
      {
        path: 'apps/host/src/main/net',
        note: 'Untouched: input never uses the WebSocket',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Send input on a WebRTC data channel the host opens next to the video',
        insteadOf: 'The WebSocket',
        reason:
          'The data channel is encrypted and only the paired viewer has it. The WebSocket is plain HTTP, and the security rules say input never travels there (ADR-013).',
      },
      {
        chose: 'Absolute positions (0 to 65535 across the picture)',
        insteadOf: 'Relative movement',
        reason:
          'A move that is lost or dropped cannot leave the pointer in the wrong place, and it works the same with and without pointer lock.',
      },
      {
        chose: 'At most one move per animation frame on the viewer, and 250 per second on the host',
        insteadOf: 'Sending every mouse event',
        reason:
          'A mouse can fire hundreds of events a second. Thinning them keeps the channel from backing up on slow links. Clicks and wheel are never dropped, because a lost "button up" would leave a button stuck.',
      },
      {
        chose: 'Release every held button when control ends or the connection drops',
        insteadOf: 'Trusting the viewer to send "button up"',
        reason: 'A viewer can vanish at any moment. The host cleans up after it.',
      },
      {
        chose: 'Parse input in `packages/protocol` and check it again in main',
        insteadOf: 'Parsing in the engine only',
        reason:
          'The engine window is a renderer, so main treats what it sends as untrusted. The injector checks ranges again before anything reaches Windows.',
      },
      {
        chose: 'Leave PilotPane\'s own window clickable through the viewer, for now',
        insteadOf: 'Blocking clicks on it',
        reason:
          'A viewer with the PIN is already trusted with the whole laptop, so clicking "New PIN" or "Disconnect" in the picture gives it nothing new. A "lock the host window while connected" option can come later.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '005', note: 'the peer connection the data channel rides on' },
      { spec: '009', note: 'the `InputInjector` interface' },
      { spec: '010', note: 'the helper that really moves the mouse' },
    ],
    unlocks: [
      { spec: '013', note: 'keyboard events can use the same channel and bridge' },
      { spec: '014', note: 'capture mode builds on the control state' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Open the channel',
        explanation:
          'The host creates the `input` data channel before it makes the offer, so the viewer receives it with the video.',
      },
      {
        title: 'Say whether input works',
        explanation:
          'After pairing, the host sends `input-state { available }`. Without the helper exe it is false and the viewer shows "Watching only".',
      },
      {
        title: 'Take control',
        explanation:
          'A click on the picture asks the browser to lock the pointer. That first click is not sent to the host. If the lock is missing or refused, the plain mouse position is used and a card explains.',
      },
      {
        title: 'Turn movement into positions',
        explanation:
          'While locked, the viewer adds up the pointer movement into a position inside the picture. `videoBox` accounts for the black bars when the picture is not the same shape as the window.',
      },
      {
        title: 'Parse, thin out, inject',
        explanation:
          'The engine parses each message and passes it to main. The bridge drops moves over 250 a second and hands the rest to the injector.',
      },
      {
        title: 'Let go',
        explanation:
          'Esc, losing the window, the viewer leaving or the connection dropping all end control and release held buttons.',
      },
    ],
  },

  code: [
    {
      file: 'packages/protocol/src/input.ts',
      excerpt: `  switch (o.type) {
    case 'mouse-move':
      return isInt(o.x, 0, COORD_MAX) && isInt(o.y, 0, COORD_MAX) ? { type: 'mouse-move', x: o.x, y: o.y } : null;
    case 'mouse-button': {
      const b = o.button;
      return (b === 'left' || b === 'right' || b === 'middle') && typeof o.down === 'boolean'
        ? { type: 'mouse-button', button: b, down: o.down }
        : null;
    }`,
      explanation:
        'Every field is checked and only known fields are copied into the result, so extra data from a viewer is dropped. Anything wrong returns `null` and the message is ignored.',
    },
    {
      file: 'apps/host/src/renderer/engine/engine.ts',
      excerpt: `  const inputChannel = peer.createDataChannel(INPUT_CHANNEL_LABEL, { ordered: true });
  inputChannel.addEventListener('message', (e: MessageEvent<unknown>) => {
    const msg = parseInputMessage(e.data);
    if (msg) emit({ evt: 'input', msg });
  });`,
      explanation:
        'The host side of the channel. Messages that do not parse never leave the engine window.',
    },
    {
      file: 'apps/host/src/main/input-bridge.ts',
      excerpt: `  private allowMove(): boolean {
    const t = this.now();
    if (t - this.windowStart >= 1000) {
      this.windowStart = t;
      this.moves = 0;
    }
    this.moves += 1;`,
      explanation:
        'A one-second window that counts moves. `now` is passed in, so the test can move time forward without waiting.',
    },
    {
      file: 'packages/protocol/src/pointer-map.ts',
      excerpt: `export function toHostCoords(clientX: number, clientY: number, box: Box): { x: number; y: number } {
  const fx = box.width > 0 ? (clientX - box.left) / box.width : 0;
  const fy = box.height > 0 ? (clientY - box.top) / box.height : 0;
  return {
    x: Math.round(clamp(fx, 0, 1) * COORD_MAX),
    y: Math.round(clamp(fy, 0, 1) * COORD_MAX)
  };
}`,
      explanation:
        'A position inside the picture becomes a number from 0 to 65535. Outside the picture it sticks to the nearest edge. It lives in the protocol package so Node tests can check it.',
    },
    {
      file: 'apps/viewer/src/pointer.ts',
      excerpt: `  private onLockChange(): void {
    if (document.pointerLockElement === this.stage) {
      this.locked = true;
      this.hooks.onChange('controlling', true);
    } else if (this.locked) {
      // Esc (or the browser) took the lock away.
      this.release();
    }
  }`,
      explanation:
        'Esc is handled by the browser, not by us: it drops the lock and fires this event. We treat that as the end of control.',
    },
  ],

  concepts: [
    {
      name: 'Pointer Lock API',
      level: 'Core',
      explanation:
        'Hides the pointer and keeps sending how far the mouse moved, so it cannot run off the edge of the window. It needs a click to start and Esc always ends it. Chrome 109 allows it on plain HTTP.',
      resources: [
        {
          title: 'MDN: Pointer Lock API',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API',
        },
        {
          title: 'MDN: Element.requestPointerLock()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock',
        },
      ],
    },
    {
      name: 'RTCDataChannel',
      level: 'Core',
      explanation:
        'A message pipe that rides on the same encrypted WebRTC connection as the video. It can be ordered and reliable (like TCP) or not. We use one ordered channel.',
      resources: [
        {
          title: 'MDN: RTCDataChannel',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel',
        },
        {
          title: 'MDN: Using WebRTC data channels',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels',
        },
      ],
    },
    {
      name: 'Letterboxing with object-fit',
      level: 'Concept',
      explanation:
        'With `object-fit: contain` a video is shrunk to fit and black bars fill the rest. A click on a bar is not on the picture, so the maths must work out where the picture really is.',
      resources: [
        {
          title: 'MDN: object-fit',
          url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit',
        },
      ],
    },
    {
      name: 'Wheel events',
      level: 'Concept',
      explanation:
        'A wheel turn can be measured in pixels, lines or pages, and down is positive. The host wants whole notches with up as positive, so the viewer converts and flips the sign.',
      resources: [
        {
          title: 'MDN: WheelEvent',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent',
        },
      ],
    },
    {
      name: 'requestAnimationFrame',
      level: 'Pattern',
      explanation:
        'Runs a function just before the next screen redraw. We use it to send only the newest mouse position once per frame instead of one message per event.',
      resources: [
        {
          title: 'MDN: window.requestAnimationFrame()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame',
        },
      ],
    },
    {
      name: 'Discriminated unions',
      level: 'Concept',
      explanation:
        '`InputMessage` is a union where `type` tells TypeScript which fields exist, so the `switch` in the bridge is checked for every case.',
      resources: [
        {
          title: 'TypeScript Handbook: Narrowing',
          url: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html',
        },
      ],
    },
  ],

  bugs: [
    {
      symptom:
        'During testing the pointer seemed to hang once when going to the PilotPane window through the viewer.',
      cause:
        'Not found. It did not happen again, and it was never seen with a second app, so it may have been a one-off network lag.',
      fix: 'No change. If it comes back, run the host with `PILOTPANE_LOG=debug` and check the input helper lines.',
    },
  ],

  quiz: [
    {
      question: 'Why does input go over the data channel and not the WebSocket?',
      answer:
        'The data channel is encrypted and only the paired viewer has it. The WebSocket is plain HTTP on the LAN.',
    },
    {
      question: 'Why are mouse moves dropped but button presses never?',
      answer:
        'The next move replaces a dropped one. A dropped "button up" would leave the button stuck on the host.',
    },
    {
      question: 'What ends control, and what does the host do then?',
      answer:
        'Esc, losing the window, leaving, or a dropped connection. The host releases every button still held.',
    },
    {
      question: 'Why is the first click on the picture not sent to the host?',
      answer: 'It is the click that takes control. Sending it too would click something on the host by accident.',
    },
  ],

  commits: [],
  commitsNote:
    'The commits for this spec are made when the pull request is prepared, so none are listed yet.',
});
