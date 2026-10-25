window.JOURNAL.push({
  number: '017',
  title: 'Keep host from sleeping',
  version: 'v0.4',
  mergedDate: '2026-10-24',
  technologies: ['Electron powerSaveBlocker', 'Dependency injection', 'node:test'],
  oneLine: 'While a viewer is paired, the host does not blank its display or sleep on the idle timer, so the picture never freezes.',

  what: {
    summary:
      'Spec 009 already added a `KeepAwake` interface and an Electron implementation, and the controller used it once the peer connection was up. That left two problems: the block was taken late (not while pairing and starting the engine), and the rule was spread over three direct calls with no test. This spec moves the rule into one small class, `AwakeGuard`, that holds the block from the moment a viewer is paired until it is gone. It runs under plain `node --test` with a fake `KeepAwake`. No network message, screen or setting was added.',
    partsTouched: [
      {
        path: 'apps/host/src/main/awake-guard.ts',
        note: 'New: `AwakeGuard`, which decides when the keep-awake block is held, with tests',
        changed: true,
      },
      {
        path: 'apps/host/src/main/controller.ts',
        note: 'Calls the guard on pairing, on viewer gone and on shutdown; the direct `keepAwake` calls are gone',
        changed: true,
      },
      {
        path: 'apps/host/src/main/platform',
        note: '`KeepAwake` and `ElectronKeepAwake` are unchanged',
        changed: false,
      },
      { path: 'docs', note: 'A note about the guard in the architecture data flow', changed: true },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Hold the block from pairing to the viewer leaving',
        insteadOf: 'Starting it only when the peer connection reaches `connected`',
        reason:
          'Starting the engine and negotiating WebRTC takes a moment, and the idle timer does not wait. Tying the block to the viewer, not to one connection state, also means a changing connection state cannot leave it stuck on or off.',
      },
      {
        chose: 'A small `AwakeGuard` class that takes a `KeepAwake` and a logger',
        insteadOf: 'Keeping the start and stop calls inside the controller',
        reason:
          'The controller imports Electron, so it cannot run under `node --test`. The guard has no Electron import, so the rule is tested with a fake.',
      },
      {
        chose: 'Release the block when the viewer socket closes, including on suspend',
        insteadOf: 'Holding it across a reconnect',
        reason:
          'A host that is going to sleep should be allowed to. The next pairing or resume takes the block again, and the guard ignores repeated calls.',
      },
      {
        chose: 'Always on, with no setting',
        insteadOf: 'A toggle in a Settings screen',
        reason:
          'The Settings screen is not designed yet (see DESIGN.md), and holding the block only while a viewer is present is the safe default.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '009', note: 'The `KeepAwake` interface and its Electron implementation' },
      { spec: '016', note: 'Suspend closes the viewer socket, which releases the block' },
    ],
    unlocks: [{ spec: '020', note: 'Start on login makes a host that stays awake more useful' }],
  },

  how: {
    steps: [
      {
        title: 'A viewer pairs',
        explanation:
          'The session calls `onPaired` and the controller calls `awake.viewerPaired()`. The guard starts the block once, logs it, and ignores any further call while it is held.',
      },
      {
        title: 'The stream runs',
        explanation:
          'The guard does nothing more. The Electron implementation holds a `prevent-display-sleep` blocker, which stops the idle timer from blanking the display or sleeping the laptop.',
      },
      {
        title: 'The viewer goes away',
        explanation:
          'Closing the tab, pausing, a new PIN, or a suspend all end in `onViewerGone`. The controller calls `awake.viewerGone()` and the guard stops the block, if it was held.',
      },
      {
        title: 'The host quits',
        explanation: '`shutdown` calls `dispose`, which releases a block that is still held.',
      },
    ],
  },

  code: [
    {
      file: 'apps/host/src/main/awake-guard.ts',
      excerpt: `export class AwakeGuard {
  private held = false;

  constructor(
    private readonly keepAwake: KeepAwake,
    private readonly log: Logger
  ) {}

  viewerPaired(): void {
    if (this.held) return;
    this.held = true;
    this.keepAwake.start();
    this.log.info('keeping the display awake');
  }

  viewerGone(): void {
    if (!this.held) return;
    this.held = false;
    this.keepAwake.stop();
    this.log.info('display may sleep again');
  }`,
      explanation:
        'One boolean makes both calls safe to repeat. The class sees only the `KeepAwake` interface, so it never touches Electron.',
    },
    {
      file: 'apps/host/src/main/controller.ts',
      excerpt: `      onPaired: (viewer) => {
        this.awake.viewerPaired();
        this.patch({ status: 'connecting', viewer, stats: null, message: null });`,
      explanation: 'The block is taken at pairing, before the engine even starts.',
    },
    {
      file: 'apps/host/src/main/awake-guard.test.ts',
      excerpt: `test('repeated calls start and stop once', () => {
  const { calls, guard } = setup();
  guard.viewerPaired();
  guard.viewerPaired();
  guard.viewerGone();
  guard.viewerGone();
  assert.deepEqual(calls, ['start', 'stop']);
});`,
      explanation: 'The fake records each call, so the test checks the exact sequence the platform would see.',
    },
  ],

  concepts: [
    {
      name: 'Electron powerSaveBlocker',
      level: 'Core',
      explanation:
        'Asks the operating system not to sleep. `prevent-display-sleep` keeps the screen and the system on. `start` returns an id, and `stop` needs that id, so the wrapper stores it.',
      resources: [
        { title: 'powerSaveBlocker (Electron docs)', url: 'https://www.electronjs.org/docs/latest/api/power-save-blocker' },
      ],
    },
    {
      name: 'Dependency injection',
      level: 'Pattern',
      explanation:
        'A class receives what it needs (here a `KeepAwake` and a logger) instead of creating it. A test then passes a fake and the same code runs without Electron.',
      resources: [
        { title: 'Object types (TypeScript handbook)', url: 'https://www.typescriptlang.org/docs/handbook/2/objects.html' },
      ],
    },
    {
      name: 'Idempotent operations',
      level: 'Pattern',
      explanation:
        'Calling the operation twice has the same effect as calling it once. The guard keeps a flag so repeated pairings or stops cannot leak or double-release a block.',
      resources: [{ title: 'Idempotent (MDN glossary)', url: 'https://developer.mozilla.org/en-US/docs/Glossary/Idempotent' }],
    },
    {
      name: 'Node test runner',
      level: 'Concept',
      explanation:
        '`node:test` and `node:assert` run tests with no extra package. Tests here use a plain array to record calls on a fake.',
      resources: [{ title: 'Test runner (Node.js docs)', url: 'https://nodejs.org/api/test.html' }],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why start the block at pairing and not when the peer connection is `connected`?',
      answer:
        'Starting the engine and negotiating WebRTC takes time, and the idle timer keeps running. Tying the block to the viewer covers that gap and cannot be left on or off by a changing connection state.',
    },
    {
      question: 'Why is the rule in `AwakeGuard` and not in the controller?',
      answer:
        'The controller imports Electron and cannot run under `node --test`. The guard only needs the `KeepAwake` interface, so a fake can test it.',
    },
    {
      question: 'What happens to the block when the host suspends?',
      answer:
        'Suspend closes the viewer socket (spec 016), which ends in `onViewerGone`, so the guard releases the block. The next pairing or resume takes it again.',
    },
  ],

  commits: [],
  commitsNote: 'The commits for this spec are listed once the branch is committed and tagged `spec-017-done`.',
});
