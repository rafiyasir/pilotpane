window.JOURNAL.push({
  number: '024',
  title: 'Packaging (portable build)',
  version: 'dist',
  mergedDate: '2026-10-21',
  technologies: ['Node fs', 'Electron runtime', 'ICO format', 'tar', 'ESM'],
  oneLine:
    'PilotPane now builds into a folder and a zip that run on a Windows PC with no Node, no pnpm and no source code.',

  what: {
    summary:
      'Until now PilotPane only ran from a checkout with `pnpm start`. `pnpm package` now copies the Electron runtime, renames it to `PilotPane.exe`, puts the compiled app beside it and zips the result. This is the base for the installer, the updater and the release pipeline that follow.',
    partsTouched: [
      {
        path: 'scripts/package.mjs',
        note: 'Stages the folder, checks it is complete and zips it',
        changed: true,
      },
      {
        path: 'scripts/make-ico.mjs',
        note: 'Wraps `icon-256.png` in an ICO container so Windows shortcuts can use it',
        changed: true,
      },
      {
        path: 'apps/host/assets/icon.ico',
        note: 'The generated icon, committed',
        changed: true,
      },
      {
        path: 'package.json and scripts/clean.mjs',
        note: 'A `package` script, and `pnpm clean` now removes `out/`',
        changed: true,
      },
      {
        path: 'apps/host/src/main/main.ts',
        note: 'Untouched: the packaged layout makes the existing path code work as it is',
        changed: false,
      },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'Copy the two workspace packages as real packages under `resources/app/node_modules/@pilotpane`',
        insteadOf: 'Changing the path code in `main.ts` for packaged builds',
        reason:
          'The existing `import.meta.resolve` calls find them unchanged, so there is one code path for development and for the package.',
      },
      {
        chose: 'No asar archive',
        insteadOf: 'Packing the app into app.asar',
        reason:
          'The input helper exe must be spawnable and the LAN server reads files from disk. Plain folders avoid both problems.',
      },
      {
        chose: 'The `tar.exe` that ships with Windows 10 and 11 to write the zip',
        insteadOf: 'A zip package from npm',
        reason: 'No dependency (ADR-002). It is called by full path so Git Bash does not pick its own GNU tar.',
      },
      {
        chose: 'Check the staged folder before zipping',
        insteadOf: 'Trusting the copy',
        reason: 'A package that looks fine but is missing a file fails later on someone else\u2019s PC.',
      },
      {
        chose: 'Leave the exe icon for later',
        insteadOf: 'Adding an icon-editing package',
        reason: 'Embedding an icon needs a package. The installer shortcuts will use `icon.ico` instead.',
      },
    ],
  },

  when: {
    dependsOn: [
      { spec: '010', note: 'The helper exe the package has to carry and keep spawnable' },
      { spec: '007', note: 'The windows, tray and assets that must load from the packaged folder' },
    ],
    unlocks: [
      { spec: '025', note: 'The installer wraps this folder' },
      { spec: '026', note: 'Updates replace this folder with a newer one' },
      { spec: '027', note: 'The release pipeline builds and publishes it' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Start from the Electron runtime',
        explanation:
          'The script copies `electron/dist` and renames `electron.exe` to `PilotPane.exe`. If Electron was never downloaded it stops with a clear message instead of producing a broken folder.',
      },
      {
        title: 'Add the app',
        explanation:
          'A small `package.json` (name, product name, version, `type: module`, `main`) goes in `resources/app`, with the compiled host beside it. Test files, source maps and type files are left out.',
      },
      {
        title: 'Add the workspace packages',
        explanation:
          '`@pilotpane/protocol` and `@pilotpane/viewer` are copied as normal packages under `node_modules`, so the host finds them the same way it does in development.',
      },
      {
        title: 'Verify, then zip',
        explanation:
          'The script lists the files that must exist and fails if any are missing or if a dev-only file slipped in. It warns, but does not fail, when the input helper is absent. Then `tar.exe` writes the zip.',
      },
    ],
  },

  code: [
    {
      file: 'scripts/package.mjs',
      excerpt: `async function stageElectron(stageDir) {
  const electronDist = join(root, 'apps/host/node_modules/electron/dist');
  try {
    await stat(join(electronDist, 'electron.exe'));
  } catch {
    throw new Error('Electron is not installed. Run \`pnpm install\` first (the electron download must not be skipped).');
  }
  await cp(electronDist, stageDir, { recursive: true, dereference: true });
  await rename(join(stageDir, 'electron.exe'), join(stageDir, 'PilotPane.exe'));
  await rm(join(stageDir, 'resources', 'default_app.asar'), { force: true });
}`,
      explanation:
        'Fail early if the runtime is missing, copy it, rename the exe and drop Electron\u2019s default demo app.',
    },
    {
      file: 'scripts/package.mjs',
      excerpt: `// Files that never belong in a shipped build.
const isDevOnly = (name) =>
  /\\.test\\.js$/.test(name) || name.endsWith('.map') || name.endsWith('.tsbuildinfo') || /\\.d\\.c?ts$/.test(name);

const copyBuilt = (from, to) =>
  cp(from, to, {
    recursive: true,
    dereference: true,
    filter: async (src) => (await stat(src)).isDirectory() || !isDevOnly(src)
  });`,
      explanation:
        'One filter decides what is left out, and the same function is used again when the stage is verified.',
    },
    {
      file: 'scripts/package.mjs',
      excerpt: `function zipStage(stageDir) {
  const zipPath = \`\${stageDir}.zip\`;
  // The tar that ships with Windows 10 and 11 writes zip files with -a. Use it by full path so Git Bash's GNU tar is not picked.
  const tar = join(process.env.SystemRoot ?? 'C:\\\\Windows', 'System32', 'tar.exe');
  const result = spawnSync(tar, ['-a', '-c', '-f', zipPath, '-C', dirname(stageDir), stageDir.split(/[\\\\/]/).pop()], {
    stdio: 'inherit'
  });
  if (result.status !== 0) throw new Error(\`tar failed with exit code \${result.status ?? 'none'}\`);
  return zipPath;
}`,
      explanation: 'Zipping with a tool Windows already has, so there is nothing to install.',
    },
    {
      file: 'scripts/make-ico.mjs',
      excerpt: `header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count
header.writeUInt8(0, 6); // width 0 means 256
header.writeUInt8(0, 7); // height 0 means 256
header.writeUInt8(0, 8); // palette size
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14); // image data size
header.writeUInt32LE(header.length, 18); // image data offset`,
      explanation:
        'An ICO file is a small header followed by image data, and the data can be a PNG as it is. So no image library is needed.',
    },
  ],

  concepts: [
    {
      name: 'Electron app layout',
      level: 'Core',
      explanation:
        'Electron looks for an app in `resources/app` (or an `app.asar`) beside the runtime. Renaming `electron.exe` changes the name users see in the task manager and in the firewall prompt.',
      resources: [
        {
          title: 'Electron: Application distribution',
          url: 'https://www.electronjs.org/docs/latest/tutorial/application-distribution',
        },
        { title: 'Electron: ASAR archives', url: 'https://www.electronjs.org/docs/latest/tutorial/asar-archives' },
      ],
    },
    {
      name: 'Module resolution',
      level: 'Core',
      explanation:
        '`import.meta.resolve` finds a package by looking in `node_modules` folders up the tree. Putting real copies in `resources/app/node_modules` makes the same lookup work in the package.',
      resources: [
        {
          title: 'Node.js: ES modules, import.meta.resolve',
          url: 'https://nodejs.org/api/esm.html#importmetaresolvespecifier',
        },
        {
          title: 'Node.js: Loading from node_modules folders',
          url: 'https://nodejs.org/api/modules.html#loading-from-node_modules-folders',
        },
      ],
    },
    {
      name: 'Copying files with a filter',
      level: 'Concept',
      explanation:
        '`fs.cp` can copy a whole tree and call a filter for each entry. Directories must return true, or the copy never goes inside them.',
      resources: [{ title: 'Node.js: fs.cp', url: 'https://nodejs.org/api/fs.html#fspromisescpsrc-dest-options' }],
    },
    {
      name: 'Failing early',
      level: 'Pattern',
      explanation:
        'Check preconditions before doing work (Electron present) and verify the result before handing it over (the stage is complete). A clear error now beats a broken package later.',
      resources: [],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why does the package contain copies of the protocol and viewer packages under `node_modules`?',
      answer:
        'So the unchanged `import.meta.resolve` calls in `main.ts` find them. The workspace symlinks of a development checkout do not exist in the package.',
    },
    {
      question: 'Why is there no asar archive?',
      answer:
        'The input helper exe must be a real file so it can be spawned, and the LAN server reads files from disk.',
    },
    {
      question: 'What happens if the input helper is missing when you run `pnpm package`?',
      answer: 'A warning is printed and the package is built. The app runs without mouse and keyboard input.',
    },
    {
      question: 'Why is `tar.exe` called by its full path?',
      answer: 'In Git Bash a plain `tar` is GNU tar, which cannot write zip files with `-a`.',
    },
  ],

  commits: [],
  commitsNote:
    'The commits for this spec are made when the pull request is prepared, so none are listed yet.',
});
