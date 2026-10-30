window.JOURNAL.push({
  number: '035',
  title: 'Close notice and Quit button',
  version: 'v0.4',
  mergedDate: '2026-10-30',
  technologies: ['Electron BrowserWindow', 'IPC', 'Settings file'],
  oneLine: 'People can tell PilotPane is still running after they close its window, and can quit it from the window itself.',

  what: {
    summary:
      'Closing the host window only hides it, so sharing carries on from the tray and the process stays in Task Manager. New users read that as "the app did not close". This spec explains it once and adds a way out. The first time someone clicks X, the close is held and a short Card says PilotPane is still running. "Keep in tray" hides the window and remembers the answer, so later closes just hide it. A "Quit PilotPane" button in the footer ends the app, and when a viewer is connected it asks first, because quitting ends the viewer picture. No network message changed.',
    partsTouched: [
      {
        path: 'apps/host/src/main/close-notice.ts',
        note: 'New and pure: `closeDecision` says whether a close should quit, hide or hold. Unit tested',
        changed: true
      },
      {
        path: 'apps/host/src/main/controller.ts',
        note: 'The window `close` handler asks `closeDecision`; new `keepInTray` and the `keep-in-tray` action',
        changed: true
      },
      {
        path: 'apps/host/src/main/settings.ts',
        note: '`closeNoticeSeen` is saved in `settings.json`; a missing or junk value counts as not seen',
        changed: true
      },
      {
        path: 'packages/protocol/src/host-internal.ts',
        note: '`HostState.closeNotice` and `HostAction` `keep-in-tray`. These are internal to the host, not network messages',
        changed: true
      },
      {
        path: 'apps/host/src/renderer/host',
        note: 'The first-close Card, the quit confirm Card and the footer Quit button',
        changed: true
      },
      { path: 'DESIGN.md', note: 'Three inventory rows and a "Close and quit" section', changed: true },
      { path: 'apps/viewer', note: 'Untouched', changed: false },
      { path: 'Close to tray itself', note: 'Behaviour unchanged: X still hides the window', changed: false }
    ]
  },

  why: {
    decisions: [
      {
        chose: 'Hold the first close and show the Card in the window',
        insteadOf: 'A notice shown after the window is hidden',
        reason:
          'A hidden window cannot show anything. The first draft of the spec said "show a notice on the first close", which only works if the window stays visible, so the close is held until the person answers.'
      },
      {
        chose: 'Show it once and remember it in settings',
        insteadOf: 'A reminder on every close',
        reason:
          'After the first explanation a repeat is noise. The flag lives in `settings.json` with the port, theme and quality, so it survives a restart.'
      },
      {
        chose: 'Ask before quitting only when a viewer is connected',
        insteadOf: 'Always asking, or never asking',
        reason:
          'With no viewer nothing is lost, so Quit is instant. With a viewer it ends their picture, and for someone whose own screen is faulty that can leave them with no display. The renderer already knows `state.viewer`, so it decides without a new message.'
      },
      {
        chose: 'A plain Quit button in the footer',
        insteadOf: 'The danger variant, next to Pause',
        reason: 'Pause and Disconnect are danger buttons. A plain button in the footer is harder to hit by mistake.'
      },
      {
        chose: 'A pure `closeDecision`',
        insteadOf: 'The rules inside the Electron `close` handler',
        reason:
          'The rule is three booleans in and one word out, so `node --test` covers every case without Electron.'
      }
    ]
  },

  when: {
    dependsOn: [
      { spec: '007', note: 'the host window and tray, and the close-to-tray behaviour' },
      { spec: '034', note: 'the pause and quit work that left the notice and the button for this spec' }
    ],
    unlocks: [{ spec: '036', note: 'more host window controls, with the same Card pattern' }]
  },

  how: {
    steps: [
      {
        title: 'The window is asked to close',
        explanation:
          'Electron fires `close` on the host window. The handler calls `closeDecision` with whether the app is quitting, whether the notice was seen and whether the Card is already showing.'
      },
      {
        title: 'The first close is held',
        explanation:
          'On `hold` the handler calls `preventDefault` and sets `closeNotice` in the host state. The renderer shows the Card. The window stays open.'
      },
      {
        title: 'The person answers',
        explanation:
          '"Keep in tray" sends `keep-in-tray`. Main sets the flag, saves settings, clears the Card and hides the window. "Quit PilotPane" sends the existing `quit`. Clicking X again while the Card shows counts as Keep in tray.'
      },
      {
        title: 'Later closes just hide',
        explanation: 'With the flag set, `closeDecision` returns `hide`, so X behaves as it did before this spec.'
      },
      {
        title: 'The footer Quit button',
        explanation:
          'With no viewer it sends `quit` at once. With a viewer it shows the confirm Card and gives the button an amber border. "Stay open" cancels, "Quit" sends `quit`. If the viewer leaves meanwhile, the Card goes away by itself.'
      }
    ]
  },

  code: [
    {
      file: 'apps/host/src/main/close-notice.ts',
      excerpt: `export function closeDecision(opts: { quitting: boolean; noticeSeen: boolean; noticeShowing: boolean }): CloseDecision {
  if (opts.quitting) return 'quit';
  if (opts.noticeSeen || opts.noticeShowing) return 'hide';
  return 'hold';
}`,
      explanation:
        'The whole rule. Quitting always lets the window close. After that, a seen notice or a showing Card both mean hide, so a second X cannot trap the person.'
    },
    {
      file: 'apps/host/src/main/controller.ts',
      excerpt: `    win.on('close', (e) => {
      const decision = closeDecision({
        quitting: this.quitting,
        noticeSeen: this.closeNoticeSeen,
        noticeShowing: this.state.closeNotice
      });
      if (decision === 'quit') return;
      // Closing the window only hides it; the host keeps sharing from the tray.
      e.preventDefault();
      if (decision === 'hold') this.patch({ closeNotice: true });
      else this.keepInTray();
    });`,
      explanation:
        'The handler only gathers facts and acts on the answer. Both `hold` and `hide` cancel the real close; `hold` also raises the flag the renderer watches.'
    },
    {
      file: 'apps/host/src/main/controller.ts',
      excerpt: `  private keepInTray(): void {
    this.closeNoticeSeen = true;
    this.patch({ closeNotice: false });
    this.persist();
    if (this.hostWindow && !this.hostWindow.isDestroyed()) this.hostWindow.hide();
  }`,
      explanation: 'One place for "hide and remember", used by the button and by a second X.'
    },
    {
      file: 'apps/host/src/renderer/host/host.ts',
      excerpt: `function requestQuit(): void {
  if (state?.viewer) setConfirmingQuit(true);
  else api.act({ action: 'quit' });
}`,
      explanation:
        'The confirm lives in the renderer because it already has the state. Main still treats `quit` as always valid, so the tray menu is unchanged.'
    }
  ],

  concepts: [
    {
      name: 'Window close event',
      level: 'Core',
      explanation:
        'A BrowserWindow emits `close` before it closes. Calling `event.preventDefault()` stops it, which is how a window can hide instead and how a first close can be held.',
      resources: [
        {
          title: 'Electron: BrowserWindow, event close',
          url: 'https://www.electronjs.org/docs/latest/api/browser-window#event-close'
        },
        { title: 'Electron: Tray', url: 'https://www.electronjs.org/docs/latest/api/tray' }
      ]
    },
    {
      name: 'IPC between window and main',
      level: 'Core',
      explanation:
        'The renderer cannot touch Node or settings. It sends a typed action through the preload bridge, and main decides what to do. A new button means a new action in the shared type.',
      resources: [
        { title: 'Electron: Inter-process communication', url: 'https://www.electronjs.org/docs/latest/tutorial/ipc' }
      ]
    },
    {
      name: 'Show once, remember',
      level: 'Pattern',
      explanation:
        'A first-time explanation is stored as a boolean next to the other settings and read on start. Invalid stored data falls back to "not seen", so the worst case is seeing the Card once more.',
      resources: [
        {
          title: 'Node.js: fs.writeFileSync',
          url: 'https://nodejs.org/api/fs.html#fswritefilesyncfile-data-options'
        }
      ]
    },
    {
      name: 'Pure decision function',
      level: 'Pattern',
      explanation:
        'Pull the rule out of the event handler into a function of plain values. The handler stays thin and the rule is tested without Electron.',
      resources: [{ title: 'Node.js: Test runner', url: 'https://nodejs.org/api/test.html' }]
    }
  ],

  bugs: [
    {
      symptom:
        'While testing, the first-close Card was judged to have too much wording, with the Quit confirm close behind.',
      cause:
        'Both Cards explained more than a person needs at that moment: what closing does, what the tray is, and how to find the icon.',
      fix: 'Cut each Card to a title and one sentence ("PilotPane is still running", "Find its icon near the clock to open this window again."; "The connected viewer will lose its picture."). The design canvas, DESIGN.md and the app were all updated.'
    }
  ],

  quiz: [
    {
      question: 'Why is the first close held instead of showing a notice after the window hides?',
      answer: 'A hidden window cannot show anything, so the close is cancelled and the Card appears in the visible window.'
    },
    {
      question: 'What happens if you click X again while the Card is showing?',
      answer: '`closeDecision` returns `hide`, which counts as "Keep in tray": the window hides and the choice is saved.'
    },
    {
      question: 'Why does Quit ask first only when a viewer is connected?',
      answer:
        'With no viewer nothing is lost. With a viewer, quitting ends their picture, which can leave someone with a faulty host screen with no display.'
    },
    {
      question: 'Where is the "seen" flag kept, and what if the file holds junk?',
      answer: 'In `settings.json` as `closeNoticeSeen`. Anything that is not `true` counts as not seen, so the Card shows once more.'
    }
  ],

  commitsNote:
    'The commits for this spec are added when the branch is prepared for the pull request. Use the Commits button once the spec-035-done tag exists.'
});
