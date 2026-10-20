window.JOURNAL.push({
  number: '007',
  title: 'Host window, tray and big PIN',
  version: 'v0.1',
  mergedDate: '2026-10-21',
  technologies: ['Electron BrowserWindow', 'Electron Tray', 'IPC', 'CSS custom properties'],
  oneLine:
    'The host app now has a face: a full-screen PIN on start, a control window, and a tray icon that keeps it running when the window is closed.',

  what: {
    summary:
      'Three pieces of UI that only render a `HostState` and send `HostAction` messages: a full-screen PIN page, a control window with ready, connected and problem views, and a tray menu. All the rules stay in the main process.',
    partsTouched: [
      {
        path: 'apps/host/src/renderer/pin',
        note: 'Full-screen PIN page with the address; closes by itself when a viewer pairs',
        changed: true,
      },
      {
        path: 'apps/host/src/renderer/host',
        note: 'Control window: ready, connected and problem views, theme chips',
        changed: true,
      },
      {
        path: 'apps/host/src/renderer/shared',
        note: '`theme.css` (four themes) and `ui.ts` (helpers and the typed bridge)',
        changed: true,
      },
      {
        path: 'apps/host/src/main/tray.ts',
        note: 'Tray icon, tooltip and menu',
        changed: true,
      },
      {
        path: 'apps/host/assets',
        note: 'App icon and tray icons (normal and 2x)',
        changed: true,
      },
      {
        path: 'apps/host/src/main/controller.ts',
        note: 'Publishes the `HostState` these pages render',
        changed: false,
      },
      {
        path: 'apps/host/src/main/preload.cts',
        note: 'The only way these pages talk to main',
        changed: false,
      },
      { path: 'apps/viewer', note: 'Unrelated to this spec', changed: false },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Electron windows and the tray API',
        insteadOf: 'A native shell',
        reason:
          'The whole host already runs on Electron, so windows, tray and capture share one language and one build (ADR-001).',
      },
      {
        chose: 'Pages that only render a `HostState` and send `HostAction` messages',
        insteadOf: 'Letting pages decide things',
        reason:
          'All rules stay in main, where they can be tested, and renderers stay sandboxed (CLAUDE.md, renderer rules).',
      },
      {
        chose: 'Keep the app in the tray when the window closes',
        insteadOf: 'Quitting',
        reason:
          'A remote screen tool must keep running while the window is out of the way. Double-clicking the tray icon brings the big PIN back.',
      },
      {
        chose: 'A single viewer in the window',
        insteadOf: 'A list',
        reason: 'Only one viewer can be active (ADR-005).',
      },
      {
        chose: 'Plain-English messages for port-busy and no-network',
        insteadOf: 'Error codes',
        reason: 'The screen should tell the user what to do, never blame them.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '005', note: 'gave us `HostState`, actions and the preload bridge' },
      { spec: '004', note: 'gave us the PIN and the single viewer' },
    ],
    unlocks: [{ spec: '008', note: "shows the viewer's stream numbers in this window" }],
  },

  how: {
    steps: [
      {
        title: 'Start with the big PIN',
        explanation:
          'On start the controller opens the big PIN window, always on top and full screen, with the PIN and the viewer address.',
      },
      {
        title: 'Pages ask for state',
        explanation:
          'The control window and the PIN window ask main for the current `HostState` and listen for changes.',
      },
      {
        title: 'Buttons send actions',
        explanation:
          'Buttons such as "New PIN", "Pause sharing" and "Disconnect viewer" send a `HostAction`. Main checks the sender and acts.',
      },
      {
        title: 'Switch views on pairing',
        explanation:
          'When a viewer pairs, the PIN window closes by itself and the control window switches to the connected view.',
      },
      {
        title: 'Live in the tray',
        explanation:
          'The tray menu offers the same actions. Closing the control window hides it. Only "Quit PilotPane" ends the app.',
      },
    ],
  },

  code: [
    {
      file: 'apps/host/src/main/tray.ts',
      excerpt: `export function viewerUrl(state: HostState): string | null {
  const first = state.addresses[0];
  return first ? \`http://\${first.address}:\${state.port}\` : null;
}`,
      explanation:
        'A pure helper that turns state into text. `null` means there is no network address yet, so the tray greys out the copy item instead of copying something wrong.',
    },
    {
      file: 'apps/host/src/renderer/shared/ui.ts',
      excerpt: `export function formatPin(pin: string): string {
  return \`\${pin.slice(0, 3)} \${pin.slice(3)}\`;
}`,
      explanation:
        'The PIN is shown as two groups of three digits so it is easy to read across a room and to type.',
    },
    {
      file: 'apps/host/src/main/tray.ts',
      excerpt: `  constructor(
    iconPath: string,
    private readonly act: (action: HostAction) => void,
    private readonly openHostWindow: () => void
  ) {
    this.tray = new Tray(nativeImage.createFromPath(iconPath));
    this.tray.setToolTip('PilotPane');
    this.tray.on('double-click', () => this.act({ action: 'show-pin-screen' }));
    this.tray.on('click', () => this.openHostWindow());
  }`,
      explanation:
        'The tray gets callbacks, not the controller itself. Click opens the control window and double-click brings the big PIN back.',
    },
  ],

  concepts: [
    {
      name: 'Tray icons',
      level: 'Core',
      explanation:
        'An icon in the notification area with a tooltip, click events and a menu. It keeps the app reachable while no window is open.',
      resources: [
        { title: 'Electron: Tray', url: 'https://www.electronjs.org/docs/latest/api/tray' },
      ],
    },
    {
      name: 'BrowserWindow',
      level: 'Core',
      explanation:
        'Each window is its own renderer process. Options like always-on-top and full screen make the big PIN page hard to miss.',
      resources: [
        {
          title: 'Electron: BrowserWindow',
          url: 'https://www.electronjs.org/docs/latest/api/browser-window',
        },
      ],
    },
    {
      name: 'Keeping the display awake',
      level: 'Concept',
      explanation:
        '`powerSaveBlocker` stops the display from sleeping while a viewer is watching.',
      resources: [
        {
          title: 'Electron: powerSaveBlocker',
          url: 'https://www.electronjs.org/docs/latest/api/power-save-blocker',
        },
      ],
    },
    {
      name: 'Electron security checklist',
      level: 'Pattern',
      explanation:
        'Safe defaults for renderers: sandbox on, context isolation on, no Node in the page, and validate every IPC sender.',
      resources: [
        {
          title: 'Electron: Security',
          url: 'https://www.electronjs.org/docs/latest/tutorial/security',
        },
      ],
    },
    {
      name: 'Themes with custom properties',
      level: 'Pattern',
      explanation:
        'The same four theme blocks power the viewer and the host windows, switched by one attribute.',
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
      question: 'Why do the pages send actions instead of changing state themselves?',
      answer:
        'Main owns the rules and can validate the sender of each message. A renderer is only a view, so a bug there cannot break pairing or streaming.',
    },
    {
      question: 'What happens to the app when you close the control window?',
      answer:
        'Nothing stops. The app stays in the tray and keeps listening. Only the tray\'s "Quit PilotPane" ends it.',
    },
    {
      question: 'Why does `viewerUrl` return `null` in some states?',
      answer:
        'With no local network there is no address to show, so the tray greys out "Copy viewer address" instead of copying something wrong.',
    },
  ],

  commits: [
    'feat(host): add shared renderer theme and ui helpers',
    'feat(host): add big pin screen',
    'feat(host): add control window',
    'feat(host): add tray menu',
    'chore(host): add app and tray icons',
  ],
});
