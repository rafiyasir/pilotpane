window.JOURNAL.push({
  number: '009',
  title: 'Host interfaces and smaller services',
  version: 'v0.2',
  mergedDate: '2026-10-21',
  technologies: ['TypeScript interfaces', 'Dependency injection', 'Observer pattern', 'node:test'],
  oneLine:
    'The host controller now talks to screen capture, keep-awake and input through small interfaces, so input injection can be added without touching capture code.',

  what: {
    summary:
      'A refactor with no change in behaviour. The state moved into a small store that tells windows and the tray when it changes. Everything that needed Electron for capture and keep-awake moved behind interfaces, and an input injector interface with a do-nothing version was added for the next specs.',
    partsTouched: [
      {
        path: 'apps/host/src/main/host-state.ts',
        note: '`HostStateStore` holds the state, merges patches and notifies subscribers',
        changed: true,
      },
      {
        path: 'apps/host/src/main/platform',
        note: '`ScreenCapturer`, `KeepAwake` and `InputInjector` interfaces, the Electron versions and `NullInputInjector`',
        changed: true,
      },
      {
        path: 'apps/host/src/main/controller.ts',
        note: 'Uses the store and the interfaces; no longer imports `desktopCapturer`, `screen` or `powerSaveBlocker`',
        changed: true,
      },
      {
        path: 'apps/host/src/main/main.ts',
        note: 'Builds the Electron versions and passes them to the controller',
        changed: true,
      },
      {
        path: 'apps/host/src/main/session.ts',
        note: 'Untouched: pairing and signaling stay as they were',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Interfaces for the platform parts, with Electron versions beside them',
        insteadOf: 'Calling Electron directly from the controller',
        reason:
          'A macOS or Linux host, or a test, can replace one piece without reading the whole controller.',
      },
      {
        chose: 'Pass the pieces in through `ControllerOptions`',
        insteadOf: 'Creating them inside the controller',
        reason: '`main.ts` is the only place that knows which version to use.',
      },
      {
        chose: 'A pure `HostStateStore`',
        insteadOf: 'A `state` field and a `patch` method inside the controller',
        reason: 'It has no Electron import, so it runs under plain `node --test`.',
      },
      {
        chose: 'A `NullInputInjector` now',
        insteadOf: 'Waiting for the real one in spec 010',
        reason: 'The controller is wired and disposed correctly before any input code exists.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '005', note: 'gave us the capture code that moved behind `ScreenCapturer`' },
      { spec: '007', note: 'gave us the windows and tray that subscribe to the state' },
      { spec: '008', note: 'gave us the stats that flow through the state' },
    ],
    unlocks: [
      { spec: '010', note: 'the C# helper becomes the real `InputInjector`' },
      { spec: '011', note: 'mouse events are handed to the injector the controller already holds' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Move the state out',
        explanation:
          'The controller creates a `HostStateStore` with the starting state. Its `patch()` now just calls the store.',
      },
      {
        title: 'Subscribe the windows and tray',
        explanation:
          'In `start()` the controller subscribes once: every change is sent to the host and PIN windows and to the tray.',
      },
      {
        title: 'Hide the Electron calls',
        explanation:
          'Screen picking and the display-media handler live in `ElectronScreenCapturer`. The power blocker lives in `ElectronKeepAwake`.',
      },
      {
        title: 'Inject them',
        explanation:
          '`main.ts` builds the Electron versions and the null injector, and passes them in. The controller only sees the interfaces.',
      },
    ],
  },

  code: [
    {
      file: 'apps/host/src/main/host-state.ts',
      excerpt: `  /** Merges \`partial\` into the state and notifies every subscriber. */
  patch(partial: Partial<HostState>): void {
    this.current = { ...this.current, ...partial };
    for (const listener of this.listeners) listener(this.current);
  }

  /** Returns a function that removes the subscription. */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }`,
      explanation:
        'The state is replaced, never changed in place, and every listener gets the new object. `subscribe` hands back the way to undo itself.',
    },
    {
      file: 'apps/host/src/main/platform/screen-capturer.ts',
      excerpt: `export interface ScreenCapturer {
  /** The primary screen, or null when there is none (multi-monitor choice comes later). */
  pickPrimary(): Promise<CaptureSource | null>;
  /** Answers the capture engine's own screen requests when \`isAllowed(frameUrl)\` is true. */
  serveDisplayRequests(isAllowed: (frameUrl: string) => boolean): void;
}`,
      explanation:
        'The controller asks for a screen and never learns how it was found. The caller decides which frames may ask.',
    },
    {
      file: 'apps/host/src/main/platform/electron-keep-awake.ts',
      excerpt: `  start(): void {
    if (this.blocker === null) this.blocker = powerSaveBlocker.start('prevent-display-sleep');
  }

  stop(): void {
    if (this.blocker !== null) {
      powerSaveBlocker.stop(this.blocker);
      this.blocker = null;
    }
  }`,
      explanation:
        'Starting twice does nothing the second time, so the controller can call `start()` without keeping track.',
    },
  ],

  concepts: [
    {
      name: 'TypeScript interfaces',
      level: 'Core',
      explanation:
        'An interface describes what something can do without saying how. Code that depends on the interface works with any class that matches it.',
      resources: [
        {
          title: 'TypeScript Handbook: Object Types',
          url: 'https://www.typescriptlang.org/docs/handbook/2/objects.html',
        },
        {
          title: 'TypeScript Handbook: Classes (implements)',
          url: 'https://www.typescriptlang.org/docs/handbook/2/classes.html',
        },
      ],
    },
    {
      name: 'Dependency injection',
      level: 'Pattern',
      explanation:
        'A class receives the things it needs instead of creating them. Tests and other platforms can hand it a different version.',
      resources: [
        {
          title: 'TypeScript Handbook: More on Functions',
          url: 'https://www.typescriptlang.org/docs/handbook/2/functions.html',
        },
      ],
    },
    {
      name: 'Observer pattern',
      level: 'Pattern',
      explanation:
        'A store keeps a set of listeners and calls each one when something changes. `Set` makes removal cheap and avoids doubles.',
      resources: [
        {
          title: 'MDN: Set',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set',
        },
      ],
    },
    {
      name: 'Electron powerSaveBlocker',
      level: 'Concept',
      explanation:
        'Asks Windows not to sleep the display while a stream is running. It returns an id that you pass back to stop it.',
      resources: [
        {
          title: 'Electron docs: powerSaveBlocker',
          url: 'https://www.electronjs.org/docs/latest/api/power-save-blocker',
        },
      ],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why does `HostStateStore` not import Electron?',
      answer:
        'So it runs under plain `node --test`. Only the files in `platform/` touch Electron.',
    },
    {
      question: 'Why does `main.ts` build the Electron pieces instead of the controller?',
      answer:
        'The controller depends on interfaces. Choosing the real version is the job of the entry point, so a test or another platform can pass a different one.',
    },
    {
      question: 'What does `NullInputInjector` do, and why have it?',
      answer:
        'It drops every event. It lets the controller hold and dispose an injector now, before the real one exists in spec 010.',
    },
  ],

  commits: [],
  commitsNote:
    'The commits for this spec are made when the pull request is prepared, so none are listed yet.',
});
