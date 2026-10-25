window.JOURNAL.push({
  number: '010',
  title: 'Own C# SendInput helper behind InputInjector',
  version: 'v0.2',
  mergedDate: '2026-10-21',
  technologies: ['C#', 'Win32 SendInput', 'child_process', 'Dependency injection', 'node:test'],
  oneLine:
    'The host can now move the mouse, click, scroll and press keys through a tiny helper program we compile ourselves, with no new packages.',

  what: {
    summary:
      'A small Windows program, `pilotpane-input.exe`, reads one text command per line and turns it into real mouse and keyboard input. The host starts it, talks to it over stdin and falls back to doing nothing if it is missing. Nothing on the viewer sends input yet; that comes in the next specs.',
    partsTouched: [
      {
        path: 'apps/host/helper',
        note: '`InputHelper.cs` (the SendInput program) and `PROTOCOL.md` (the text commands it understands)',
        changed: true,
      },
      {
        path: 'scripts/build-helper.mjs',
        note: 'Compiles the C# file with the `csc.exe` that ships with Windows; runs at the end of `pnpm build`',
        changed: true,
      },
      {
        path: 'apps/host/src/main/platform',
        note: '`InputCommand`, `HelperInputInjector` and `spawnHelper`; `InputInjector` now takes a typed command',
        changed: true,
      },
      {
        path: 'apps/host/src/main/main.ts',
        note: 'Uses the helper when the exe exists, otherwise `NullInputInjector`',
        changed: true,
      },
      {
        path: 'scripts/input-demo.mjs',
        note: 'A manual check that traces a square with the cursor',
        changed: true,
      },
      {
        path: 'apps/host/src/main/net',
        note: 'Untouched: nothing here listens on a socket',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Our own C# helper compiled with the .NET Framework `csc.exe` already on Windows',
        insteadOf: 'nut.js, an FFI package or a C++ addon',
        reason:
          'No npm package, no paid prebuilds, no Visual Studio. The helper is one readable file (ADR-003).',
      },
      {
        chose: 'A one-line-per-command text protocol over stdin',
        insteadOf: 'A socket or JSON',
        reason:
          'A pipe to our own child process is not reachable from the network, and a line like `M 100 200` is easy to test and to read.',
      },
      {
        chose: 'Check every value in `formatCommand` before it reaches the helper',
        insteadOf: 'Trusting the caller',
        reason:
          'Input is powerful. Bad numbers are dropped on the host side, and the helper checks again.',
      },
      {
        chose: 'Give `HelperInputInjector` a `spawn` function instead of calling `child_process` itself',
        insteadOf: 'Starting the real exe inside the class',
        reason: 'Tests use a fake process, so they run fast and need no Windows exe.',
      },
      {
        chose: 'A missing or crashed helper only turns input off',
        insteadOf: 'Failing the host',
        reason:
          'Screen sharing still works. The injector restarts the helper once, then stays off and logs it.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '009', note: 'gave us the `InputInjector` interface and `NullInputInjector` to replace' },
    ],
    unlocks: [
      { spec: '011', note: 'mouse events from the viewer are turned into these commands' },
      { spec: '013', note: 'keyboard events use the same `key` command' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Describe the input',
        explanation:
          '`InputCommand` has four kinds: move, button, wheel and key. `formatCommand` checks the ranges and returns one protocol line, or `null`.',
      },
      {
        title: 'Build the helper',
        explanation:
          '`pnpm build` finds `csc.exe` under the Windows folder and compiles `InputHelper.cs`. If the compiler is missing it only warns.',
      },
      {
        title: 'Start it and wait for ready',
        explanation:
          '`HelperInputInjector` spawns the exe. The helper prints `ready`; until then commands are dropped.',
      },
      {
        title: 'Send lines, remember what is held',
        explanation:
          'Each valid command is written as a line. The injector remembers pressed buttons and keys so it can release them.',
      },
      {
        title: 'Clean up',
        explanation:
          '`dispose()` releases anything held and closes stdin. The helper also releases everything and exits when stdin closes, even if the host crashes.',
      },
    ],
  },

  code: [
    {
      file: 'apps/host/src/main/platform/input-command.ts',
      excerpt: `export function formatCommand(cmd: InputCommand): string | null {
  switch (cmd.kind) {
    case 'move':
      return isInt(cmd.x, 0, COORD_MAX) && isInt(cmd.y, 0, COORD_MAX) ? \`M \${cmd.x} \${cmd.y}\` : null;
    case 'button': {
      const code = BUTTON_CODE[cmd.button];
      return code === undefined || typeof cmd.down !== 'boolean' ? null : \`B \${code} \${cmd.down ? 1 : 0}\`;
    }`,
      explanation:
        'Positions are whole numbers from 0 to 65535 across the screen. Anything else becomes `null` and never reaches the helper.',
    },
    {
      file: 'apps/host/helper/InputHelper.cs',
      excerpt: `    private static void Send(INPUT input)
    {
        if (SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT))) == 0)
            Console.Error.WriteLine("SendInput failed: " + Marshal.GetLastWin32Error());
    }`,
      explanation:
        'The one place that talks to Windows. `SendInput` takes a list of input records; a result of 0 means it was blocked.',
    },
    {
      file: 'apps/host/src/main/platform/helper-input-injector.ts',
      excerpt: `    proc.onExit(() => {
      if (this.proc !== proc) return;
      this.proc = null;
      this.ready = false;
      if (this.disposed) return;
      if (this.restarts < MAX_RESTARTS) {
        this.restarts += 1;
        log.warn('input helper stopped, restarting once');
        this.launch();
      } else {
        log.warn('input helper stopped again, input is off until the host restarts');
      }
    });`,
      explanation:
        'One restart, then give up quietly. The check `this.proc !== proc` ignores a late exit from an older process.',
    },
    {
      file: 'apps/host/src/main/main.ts',
      excerpt: `function createInjector(exePath: string): InputInjector {
  if (!existsSync(exePath)) {
    log.warn('input helper not found, mouse and keyboard control is off');
    return new NullInputInjector();
  }
  return new HelperInputInjector({ spawn: () => spawnHelper(exePath) });
}`,
      explanation:
        'The entry point chooses the real or the do-nothing version. The controller never knows which one it got.',
    },
  ],

  concepts: [
    {
      name: 'Win32 SendInput',
      level: 'Core',
      explanation:
        'The Windows call that puts mouse and keyboard events into the system as if a person made them. It cannot reach the UAC secure desktop or windows of higher integrity.',
      resources: [
        {
          title: 'Microsoft Learn: SendInput function',
          url: 'https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput',
        },
        {
          title: 'Microsoft Learn: Virtual-Key Codes',
          url: 'https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes',
        },
      ],
    },
    {
      name: 'Platform invoke (P/Invoke)',
      level: 'Concept',
      explanation:
        'How C# calls a Windows function from a DLL. You declare the function and the matching struct layouts with attributes.',
      resources: [
        {
          title: 'Microsoft Learn: Platform Invoke',
          url: 'https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke',
        },
      ],
    },
    {
      name: 'Child processes and stdio pipes',
      level: 'Core',
      explanation:
        'The host starts the helper and writes to its stdin. Closing stdin tells the helper to finish, which is how it dies together with the host.',
      resources: [
        {
          title: 'Node.js docs: child_process.spawn',
          url: 'https://nodejs.org/api/child_process.html#child_processspawncommand-args-options',
        },
        {
          title: 'Node.js docs: readline',
          url: 'https://nodejs.org/api/readline.html',
        },
      ],
    },
    {
      name: 'Dependency injection',
      level: 'Pattern',
      explanation:
        'The injector receives a `spawn` function instead of creating the process itself, so a test can pass a fake one.',
      resources: [
        {
          title: 'TypeScript Handbook: More on Functions',
          url: 'https://www.typescriptlang.org/docs/handbook/2/functions.html',
        },
      ],
    },
    {
      name: 'Discriminated unions',
      level: 'Concept',
      explanation:
        '`InputCommand` is a union where `kind` tells TypeScript which fields exist, so each `case` in `formatCommand` is checked.',
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
        'In the manual test guide, renaming the exe and running `pnpm start` did not show the "helper not found" warning; the exe came back by itself.',
      cause: '`pnpm start` runs `pnpm build` first, and the build now recompiles the helper every time.',
      fix: 'The failure-case step now uses `pnpm --filter @pilotpane/host start`, which skips the build.',
    },
  ],

  quiz: [
    {
      question: 'Why does the helper exit when stdin closes?',
      answer:
        'So it cannot outlive the host. It also releases any held buttons and keys first, so nothing stays pressed.',
    },
    {
      question: 'What happens if `pilotpane-input.exe` is missing?',
      answer:
        '`main.ts` uses `NullInputInjector` and logs one warning. Screen sharing still works; only input is off.',
    },
    {
      question: 'Why does `HelperInputInjector` take a `spawn` function?',
      answer: 'So tests can pass a fake process and run under plain `node --test` without Windows or the exe.',
    },
    {
      question: 'Can the helper send input to the UAC prompt?',
      answer: 'No. Windows does not allow it for programs running at normal integrity.',
    },
  ],

  commits: [],
  commitsNote:
    'The commits for this spec are made when the pull request is prepared, so none are listed yet.',
});
