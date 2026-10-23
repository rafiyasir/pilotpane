window.JOURNAL.push({
  number: '013',
  title: 'Keyboard events',
  version: 'v0.3',
  mergedDate: '2026-10-23',
  technologies: ['KeyboardEvent.code', 'WebRTC data channel', 'Windows virtual-key codes', 'Cache-Control', 'node:test'],
  oneLine: 'Typing on the viewer now types on the host, with the same keys, shortcuts and layout the host already uses.',

  what: {
    summary:
      'While the viewer is controlling the host, key presses travel over the encrypted input data channel and are typed by the same C# helper that moves the mouse. The viewer sends the physical key, not a character, so the host keyboard layout decides what appears and shortcuts such as Ctrl+C work. Esc is never sent because it lets go of control. Held keys are lifted when control ends, the window loses focus or the connection drops, so Shift never sticks.',
    partsTouched: [
      {
        path: 'packages/protocol/src',
        note: 'New `keys.ts` (code to virtual-key table), `key-tracker.ts` (what to forward, what is held) and a `key` message in `input.ts`',
        changed: true,
      },
      {
        path: 'apps/host/src/main/input-bridge.ts',
        note: 'Maps `key` messages to key commands; keys are never dropped',
        changed: true,
      },
      {
        path: 'apps/viewer/src/keyboard.ts',
        note: 'New: listens for keys while controlling and sends them',
        changed: true,
      },
      {
        path: 'apps/host/src/main/app-protocol.ts',
        note: 'Bundle files are served with `no-store` so a hidden window never runs an old module',
        changed: true,
      },
      {
        path: 'apps/host/helper',
        note: 'No change: the helper already understood `K vk d` from spec 010',
        changed: false,
      },
      {
        path: 'docs',
        note: 'ADR-015 and the architecture message paragraph',
        changed: true,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Send the physical key (`KeyboardEvent.code`) and map it on the host',
        insteadOf: 'Sending typed characters or virtual-key codes from the viewer',
        reason:
          'A physical code is the same on any viewer layout, and the host layout then makes the right character. That keeps shortcuts working (ADR-015). Cost: no IME or dead-key typing from the viewer.',
      },
      {
        chose: 'One shared key table in `packages/protocol`',
        insteadOf: 'A table on each side',
        reason: 'It is tested once, and the parser can reject any code the host would not type.',
      },
      {
        chose: 'Put the held-key logic in the protocol package as `KeyTracker`',
        insteadOf: 'Keeping it inside the viewer file',
        reason:
          'The viewer has no test runner. A pure class in the shared package gets real unit tests under `node --test`.',
      },
      {
        chose: 'Never send Esc, and ignore key repeats',
        insteadOf: 'Forwarding every event',
        reason:
          'Esc is how the viewer lets go of control. The host OS repeats a held key on its own, so repeats from the viewer would only flood the channel.',
      },
      {
        chose: 'Leave capture mode and the shortcut bar for spec 014',
        insteadOf: 'Designing them here',
        reason:
          'That screen is not designed yet. Alt+Tab, the Windows key and Ctrl+W stay with the browser until then.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '010', note: 'the helper and its `K vk d` command' },
      { spec: '011', note: 'the input data channel, the bridge and the Controlling state' },
    ],
    unlocks: [{ spec: '014', note: 'capture mode and a shortcut bar for keys the browser keeps' }],
  },

  how: {
    steps: [
      {
        title: 'Take control',
        explanation:
          'Clicking the picture starts control (spec 011). `keyboard.ts` only acts while the pointer controller says it is controlling.',
      },
      {
        title: 'Decide what to send',
        explanation:
          '`KeyTracker.press` ignores Esc, unknown keys and repeats, remembers each key that went down, and ignores a key up it never sent down.',
      },
      {
        title: 'Cross the data channel',
        explanation:
          'The message `{ type: "key", code, down }` goes over the `input` channel. The engine window checks it with `parseInputMessage`, which rejects codes outside the table.',
      },
      {
        title: 'Type it on the host',
        explanation:
          'The bridge turns the code into a virtual-key code and the injector writes `K vk 1` or `K vk 0` to the helper, which calls `SendInput`.',
      },
      {
        title: 'Let go safely',
        explanation:
          'When control ends, the window blurs or the tab hides, the viewer sends a key up for every held key. The host also releases held keys if the connection drops.',
      },
    ],
  },

  code: [
    {
      file: 'packages/protocol/src/key-tracker.ts',
      excerpt: `  press(code: string, down: boolean, repeat: boolean): InputMessage | null {
    // Esc is how the viewer lets go of control, so it is never typed on the host.
    if (code === 'Escape' || keyCodeToVk(code) === null) return null;
    if (down) {
      // The host's own OS repeats a held key; sending repeats would only flood the channel.
      if (repeat || this.held.has(code)) return null;
      this.held.add(code);
      return { type: 'key', code, down: true };
    }
    // A key up for something we never sent down must not reach the host.
    return this.held.delete(code) ? { type: 'key', code, down: false } : null;
  }`,
      explanation: 'All the forwarding rules in one pure method, so they are easy to test without a browser.',
    },
    {
      file: 'apps/host/src/main/input-bridge.ts',
      excerpt: `      case 'key': {
        const vk = keyCodeToVk(msg.code);
        if (vk !== null) this.injector.inject({ kind: 'key', vk, down: msg.down });
        return;
      }`,
      explanation: 'Keys skip the move rate limit. Dropping a key up would leave the key stuck down on the host.',
    },
    {
      file: 'apps/viewer/src/keyboard.ts',
      excerpt: `    // A toolbar button that kept focus would treat Enter or Space as a click
    // (Enter on "Exit fullscreen" leaves fullscreen). Typing belongs to the host.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
    if (e.code !== 'Escape') e.preventDefault();
    const msg = this.tracker.press(e.code, down, e.repeat);
    if (msg) this.hooks.send(msg);`,
      explanation:
        'The fix for Enter leaving fullscreen: take focus off the toolbar and stop the browser acting on the key.',
    },
    {
      file: 'apps/host/src/main/app-protocol.ts',
      excerpt: `    // The bundle changes between builds: never let Chromium reuse an old copy of a module.
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, headers });`,
      explanation: 'A response from `net.fetch` is read-only, so the headers are copied into a new `Response`.',
    },
  ],

  concepts: [
    {
      name: 'KeyboardEvent.code',
      level: 'Core',
      explanation:
        '`code` names the physical key (`KeyA`, `Enter`) no matter the layout, while `key` is the character it makes. Sending `code` keeps the viewer layout out of the picture.',
      resources: [
        {
          title: 'MDN: KeyboardEvent.code',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code',
        },
        { title: 'W3C: UI Events KeyboardEvent code values', url: 'https://www.w3.org/TR/uievents-code/' },
      ],
    },
    {
      name: 'SendInput and virtual-key codes',
      level: 'Concept',
      explanation:
        'Windows takes keyboard input as virtual-key codes. The helper sends them with `SendInput`, which types into whatever window is in front.',
      resources: [
        {
          title: 'Microsoft Docs: Virtual-Key Codes',
          url: 'https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes',
        },
        {
          title: 'Microsoft Docs: SendInput',
          url: 'https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput',
        },
      ],
    },
    {
      name: 'HTTP caching',
      level: 'Concept',
      explanation:
        'A file served without cache headers can be reused by the browser for a while. `Cache-Control: no-store` says never keep a copy, which suits files that change between builds.',
      resources: [
        {
          title: 'MDN: Cache-Control',
          url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control',
        },
      ],
    },
    {
      name: 'Default actions of keys on buttons',
      level: 'Pattern',
      explanation:
        'A focused button turns Enter or Space into a click. Calling `preventDefault` on the key event, or moving focus away, stops that.',
      resources: [
        {
          title: 'MDN: Event.preventDefault()',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault',
        },
      ],
    },
  ],

  bugs: [
    {
      symptom: 'Typing on the viewer did nothing on the host, with no errors anywhere. The mouse worked.',
      cause:
        'The hidden engine window loads the protocol files over `app://` with no cache headers, so Chromium probably kept an old `input.js` that did not know the `key` message and dropped it without a word. This is the likely cause, not proven: typing worked right after the fix and a debug log were added.',
      fix: 'Serve the bundle with `Cache-Control: no-store`, and log each key that reaches the host at debug level.',
    },
    {
      symptom: 'Pressing Enter in fullscreen left fullscreen and ended control.',
      cause:
        'The best explanation is the Fullscreen toolbar button keeping keyboard focus, so Enter clicked it again. Not confirmed on a second run yet.',
      fix: 'While controlling, the viewer blurs the focused element and calls `preventDefault` on every key except Esc.',
    },
  ],

  quiz: [
    {
      question: 'Why does the viewer send `code` and not the typed character?',
      answer:
        'The host layout should decide the character, and shortcuts like Ctrl+C need the physical key. `code` is the same on every layout.',
    },
    {
      question: 'Why are key messages never rate limited?',
      answer: 'Dropping a key up would leave the key held down on the host. Only the flood of mouse moves is thinned out.',
    },
    {
      question: 'Why is Esc not sent to the host?',
      answer: 'Esc is how the viewer lets go of control, so it has to stay with the viewer.',
    },
    {
      question: 'What stops Shift from sticking when the viewer window loses focus?',
      answer:
        'The viewer sends a key up for every held key on blur, and the host releases held keys when control ends or the connection drops.',
    },
  ],

  commits: [],
  commitsNote: 'The commits for this spec are made when the pull request is prepared, so none are listed yet.',
});
