window.JOURNAL.push({
  number: '026',
  title: 'In-app updates',
  version: 'dist',
  mergedDate: '2026-10-22',
  technologies: ['Ed25519 signatures', 'Node crypto', 'Electron net.fetch', 'SHA-256', 'Node child_process', 'cmd.exe'],
  oneLine:
    'PilotPane can now check for a newer version when you click a button, prove the download is genuine, and install it.',

  what: {
    summary:
      'Until now a new version meant downloading and running the installer by hand. Now "Check for updates" (tray menu or host window) fetches a small signed note called the manifest from GitHub Pages. If it names a newer version, you click Download, PilotPane checks the file against the note, and "Restart to install" closes the app, runs the silent installer from spec 025 and starts the app again. Nothing is checked in the background: no click, no internet request.',
    partsTouched: [
      {
        path: 'packages/protocol/src/update.ts',
        note: 'The manifest type, the exact bytes that get signed, and a parser that never throws',
        changed: true,
      },
      {
        path: 'apps/host/src/main/updater',
        note: 'Signature check, the check/download/verify state machine, the installer hand-off, and the one file that touches the internet',
        changed: true,
      },
      {
        path: 'apps/host/src/main/controller.ts',
        note: 'Four new actions, update state in HostState, the install step',
        changed: true,
      },
      { path: 'apps/host/src/main/tray.ts', note: 'One new menu item, "Check for updates"', changed: true },
      {
        path: 'apps/host/src/renderer/host',
        note: 'The update card in the host window and a footer button',
        changed: true,
      },
      {
        path: 'scripts/sign-manifest.mjs',
        note: 'Makes the key pair and signs a manifest at release time',
        changed: true,
      },
      {
        path: 'docs',
        note: 'ADR-011, a security note about the one internet request, and a "Publishing an update" section',
        changed: true,
      },
      {
        path: 'apps/viewer',
        note: 'Untouched: updates are a host feature and no network message changed',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'A manifest signed with Ed25519, checked against a public key built into the app',
        insteadOf: 'Trusting HTTPS alone, or a ready-made updater like electron-updater',
        reason:
          'HTTPS only proves which server answered. If someone took over the hosting account they could ship their own installer. A signature needs the private key, which never leaves the maintainer’s machine. Node already has Ed25519, so there is no new package. Recorded as ADR-011.',
      },
      {
        chose: 'Check only when the user clicks',
        insteadOf: 'A check at startup or on a timer',
        reason:
          'PilotPane has promised that nothing leaves the local network. A background check would break that promise quietly. A click makes the one internet request something the user asked for.',
      },
      {
        chose: 'Sign the size and SHA-256 of the installer inside the manifest',
        insteadOf: 'Signing only the version and trusting the download link',
        reason:
          'The installer is large and lives somewhere else. Because its fingerprint is inside the signed note, a swapped or damaged download is caught and deleted before it can run.',
      },
      {
        chose: 'A small detached cmd script that waits, runs the installer, then restarts the app',
        insteadOf: 'Running the installer directly from the app',
        reason:
          'The silent installer refuses to run while PilotPane is open and does not start it afterwards. So the app quits first and the script does the rest. If the installer fails, the old version just starts again.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '024', note: 'the packaged build the installer wraps' },
      { spec: '025', note: 'the silent installer (`/S`) that does the actual upgrade' },
    ],
    unlocks: [
      { spec: '027', note: 'a release pipeline that builds, signs and publishes the manifest automatically' },
    ],
  },

  how: {
    steps: [
      {
        title: 'The user clicks Check for updates',
        explanation:
          'The tray item or the footer button sends the `check-for-updates` action. The controller shows the host window and calls `Updater.check()`.',
      },
      {
        title: 'Fetch the manifest',
        explanation:
          'Electron’s `net.fetch` gets `manifest.json` with a timeout and a size cap of 8 KB. A network error becomes the "offline" failure.',
      },
      {
        title: 'Parse, then verify the signature',
        explanation:
          '`parseUpdateManifest` checks every field and returns a reason instead of throwing. Then `verifyManifest` rebuilds the signed text with `canonicalPayload` and checks the Ed25519 signature. One changed character anywhere fails it.',
      },
      {
        title: 'Compare versions',
        explanation:
          'Same or older means "You are up to date" and no download is offered. A newer version shows the "Update available" card with the notes.',
      },
      {
        title: 'Download and check the file',
        explanation:
          'Download streams the installer to a temp folder and stops if it grows past the signed size. Then the size and SHA-256 are compared with the manifest. A mismatch deletes the file and shows "Could not update".',
      },
      {
        title: 'Restart to install',
        explanation:
          'The controller starts the detached cmd script, then quits the app. The script waits about three seconds, runs `Setup.exe /S`, then starts PilotPane again.',
      },
    ],
  },

  code: [
    {
      file: 'packages/protocol/src/update.ts',
      excerpt: `export function canonicalPayload(m: Omit<UpdateManifest, 'signature'>): string {
  return ['pilotpane-update:v1', m.version, m.url, m.sha256, String(m.size), String(m.notes.length), ...m.notes].join(
    '\\n'
  );
}`,
      explanation:
        'The exact text that gets signed. Fields come in a fixed order, one per line, and the number of notes is included so two different manifests can never produce the same text. The signing script and the host both call this one function, so they cannot disagree.',
    },
    {
      file: 'apps/host/src/main/updater/verify.ts',
      excerpt: `export function verifyManifest(manifest: UpdateManifest, publicKeyPem: string): boolean {
  try {
    const { signature, ...unsigned } = manifest;
    const data = Buffer.from(canonicalPayload(unsigned), 'utf8');
    return verify(null, data, createPublicKey(publicKeyPem), Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}`,
      explanation:
        'The whole signature check. Any problem, such as a bad key or a garbled signature, counts as "not verified" instead of crashing the host. For Ed25519 the algorithm argument to `verify` is `null`.',
    },
    {
      file: 'apps/host/src/main/updater/updater.ts',
      excerpt: `    this.set({ phase: 'verifying', version: m.version });
    try {
      const facts = await this.opts.inspect(dest);
      if (facts.size !== m.size || facts.sha256 !== m.sha256) {
        log.warn('downloaded file does not match the signed manifest');
        await this.discard(dest);
        return this.fail('bad-download');
      }`,
      explanation:
        'After the download, the file is compared with the signed numbers. On a mismatch it is deleted at once and nothing can run it. `inspect` is passed in, so tests use a fake instead of a real file.',
    },
    {
      file: 'apps/host/src/main/updater/apply.ts',
      excerpt: `  const script = \`ping -n 4 127.0.0.1 >nul & "\${o.installerPath}" /S & start "" "\${o.relaunchPath}"\`;
  // With /s, cmd strips the outer quotes and runs the rest as written.
  o.spawn('cmd.exe', ['/d', '/s', '/c', \`"\${script}"\`]);
  o.quit();`,
      explanation:
        'The hand-off. `ping -n 4` is a three second wait that works on every Windows. The script then runs the installer silently and starts the app. Before this, paths with characters cmd treats as commands (`& % " ^ | < >`) are refused.',
    },
  ],

  concepts: [
    {
      name: 'Digital signatures (Ed25519)',
      level: 'Core',
      explanation:
        'A key pair has a private half that signs and a public half that checks. Only the private key can make a signature that the public key accepts. The public key can live in the app and in the repo because it cannot sign anything.',
      resources: [
        { title: 'Node.js docs: crypto.verify', url: 'https://nodejs.org/api/crypto.html#cryptoverifyalgorithm-data-key-signature-callback' },
        { title: 'IETF RFC 8032: Ed25519', url: 'https://www.rfc-editor.org/rfc/rfc8032' },
      ],
    },
    {
      name: 'Hashes and file integrity',
      level: 'Core',
      explanation:
        'A SHA-256 hash is a fingerprint of a file. If even one byte changes, the fingerprint changes. Putting the fingerprint inside a signed note makes the note vouch for the file.',
      resources: [
        { title: 'Node.js docs: crypto.createHash', url: 'https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options' },
        { title: 'Node.js docs: fs.createReadStream', url: 'https://nodejs.org/api/fs.html#fscreatereadstreampath-options' },
      ],
    },
    {
      name: 'Canonical form',
      level: 'Concept',
      explanation:
        'Signing JSON directly is risky because the same data can be written in different ways (spacing, key order). Signing a fixed, plain text built from the fields avoids that.',
      resources: [
        { title: 'IETF RFC 8785: JSON Canonicalization Scheme', url: 'https://www.rfc-editor.org/rfc/rfc8785' },
      ],
    },
    {
      name: 'Streaming a download',
      level: 'Concept',
      explanation:
        'Reading the body chunk by chunk lets the app write to disk as it goes, show progress, and stop as soon as the file is bigger than promised, without holding 150 MB in memory.',
      resources: [
        { title: 'MDN: ReadableStream getReader', url: 'https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/getReader' },
        { title: 'MDN: AbortController', url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController' },
        { title: 'Electron docs: net.fetch', url: 'https://www.electronjs.org/docs/latest/api/net#netfetchurl-init' },
      ],
    },
    {
      name: 'State machine',
      level: 'Pattern',
      explanation:
        'The updater is always in exactly one phase: idle, checking, available, downloading, verifying, ready or failed. The window just draws the current phase, and calls that do not fit the phase are ignored.',
      resources: [
        { title: 'TypeScript handbook: discriminated unions', url: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions' },
      ],
    },
    {
      name: 'Dependency injection for tests',
      level: 'Pattern',
      explanation:
        'The updater gets its fetch, download, file check and clock as arguments. Tests give it fakes, so every failure path runs in milliseconds without internet or Electron.',
      resources: [
        { title: 'Node.js docs: test runner', url: 'https://nodejs.org/api/test.html' },
      ],
    },
    {
      name: 'Starting a detached process',
      level: 'Concept',
      explanation:
        'A detached child with its output ignored keeps running after its parent exits. That is what lets the install script outlive the app that started it.',
      resources: [
        { title: 'Node.js docs: child_process.spawn', url: 'https://nodejs.org/api/child_process.html#child_processspawncommand-args-options' },
        { title: 'Microsoft docs: cmd', url: 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd' },
      ],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why is a signed manifest safer than downloading over HTTPS alone?',
      answer:
        'HTTPS proves which server answered, not who made the file. With a signature, someone who takes over the hosting still cannot make an update the app accepts, because they do not have the private key.',
    },
    {
      question: 'What happens if one letter of a note in the manifest is edited after signing?',
      answer:
        'The rebuilt signed text no longer matches the signature, so the check fails and the app shows "Could not update" without downloading anything.',
    },
    {
      question: 'Why is the installer’s SHA-256 inside the signed manifest?',
      answer:
        'The installer is hosted elsewhere and is not signed itself. Its fingerprint in the signed note lets the app tell a genuine file from a swapped or damaged one.',
    },
    {
      question: 'Why does the app quit before the installer runs?',
      answer:
        'The silent installer exits with code 2 if PilotPane is running, and it does not start the app afterwards. A small script waits for the app to close, installs, and starts it again.',
    },
    {
      question: 'Why does the download stop when it passes the size in the manifest?',
      answer:
        'A server that sends more than it promised could fill the disk. The signed size is a hard cap, and the file is deleted if it does not match.',
    },
    {
      question: 'Why does the test update still say v0.1.0 afterwards?',
      answer:
        'The test manifest claimed 0.2.0 but pointed at the 0.1.0 installer. The update flow is identical, but the app that gets installed is still 0.1.0.',
    },
  ],

  commits: [],
  commitsNote: 'The commits for this spec are made when the pull request is prepared, so none are listed yet.',
});
