window.JOURNAL.push({
  number: '001',
  title: 'Monorepo scaffold',
  version: 'v0.1',
  mergedDate: '2026-10-21',
  technologies: ['pnpm', 'TypeScript', 'Node test runner', 'ES modules'],
  oneLine:
    'The project got a home where three packages build together with strict TypeScript and no third-party runtime code.',

  what: {
    summary:
      "A pnpm workspace with shared strict TypeScript settings, four build scripts and the project rules. `pnpm build` compiles every project in order and copies the files TypeScript ignores. `pnpm test` builds and then runs Node's own test runner.",
    partsTouched: [
      {
        path: 'package.json',
        note: 'Root scripts: `build`, `test`, `start`, `clean`',
        changed: true,
      },
      {
        path: 'pnpm-workspace.yaml',
        note: 'Declares `apps/*` and `packages/*`, allows install scripts only for Electron',
        changed: true,
      },
      { path: 'pnpm-lock.yaml', note: 'Pins every dependency version', changed: true },
      { path: 'tsconfig.base.json', note: 'Shared strict compiler settings', changed: true },
      {
        path: 'tsconfig.json',
        note: 'Root project that builds all four TypeScript projects with `tsc -b`',
        changed: true,
      },
      {
        path: 'scripts/',
        note: '`copy-static.mjs` copies HTML, CSS and images next to compiled output; `clean.mjs` removes `dist` folders',
        changed: true,
      },
      {
        path: 'docs/',
        note: 'Overview, architecture, decisions, spec, plus README, CLAUDE.md and the policies',
        changed: true,
      },
      { path: 'apps/', note: 'Empty so far, filled by specs 003 to 008', changed: false },
      { path: 'packages/', note: 'Empty so far, filled by spec 002', changed: false },
    ],
  },

  why: {
    decisions: [
      {
        chose: 'pnpm 10 workspaces, no Turborepo',
        insteadOf: 'npm or yarn, or a task runner on top',
        reason:
          'pnpm blocks dependency install scripts by default, which enforces the "no third-party packages" rule on its own. `tsc -b` already builds projects in the right order (ADR-006).',
      },
      {
        chose: 'Write features ourselves, use only the platform and official dev tools',
        insteadOf: '`ws`, `express` or bundlers',
        reason: 'The supply chain stays small and every piece becomes a lesson (ADR-002).',
      },
      {
        chose: 'The MIT license',
        insteadOf: 'AGPL or GPL',
        reason:
          'It is the simplest for a learning project that should be easy to reuse (ADR-006).',
      },
      {
        chose: 'A small Node script to copy static files',
        insteadOf: 'A bundler',
        reason:
          'The project only has to copy HTML, CSS and images, and Node can do that in 30 lines.',
      },
    ],
  },

  when: {
    dependsOn: [],
    unlocks: [
      {
        spec: '002',
        note: 'the typed protocol goes in `packages/protocol`, built and tested by these scripts',
      },
      { spec: '003', note: 'the host package plugs into the same `tsc -b` build' },
    ],
  },

  how: {
    steps: [
      {
        title: 'Install links the workspace',
        explanation:
          '`pnpm install` reads `pnpm-workspace.yaml`, finds the packages under `apps/` and `packages/`, and links them to each other as `workspace:*`.',
      },
      {
        title: 'Build in order',
        explanation:
          '`pnpm build` runs `tsc -b`. The root `tsconfig.json` lists each project as a reference, so TypeScript builds them in dependency order.',
      },
      {
        title: 'Copy what TypeScript ignores',
        explanation:
          'Right after, `node scripts/copy-static.mjs` copies HTML, CSS and PNG files into each `dist` folder.',
      },
      {
        title: 'Test the compiled output',
        explanation:
          "`pnpm test` builds first, then runs Node's built-in test runner on the compiled `*.test.js` files.",
      },
      {
        title: 'Clean',
        explanation: '`pnpm clean` removes the `dist` folders so the next build starts fresh.',
      },
    ],
  },

  code: [
    {
      file: 'pnpm-workspace.yaml',
      excerpt: `packages:
  - apps/*
  - packages/*

# pnpm 10 blocks install scripts of dependencies by default.
# Only Electron may run one (it downloads its own binary).
# Any other package asking to run a script is skipped with a warning.
onlyBuiltDependencies:
  - electron`,
      explanation:
        'The whole dependency policy in a few lines. Anything that asks to run code during install is skipped unless it is on this list, and only Electron is.',
    },
    {
      file: 'scripts/copy-static.mjs',
      excerpt: `const STATIC = new Set(['.html', '.css', '.png', '.ico', '.svg']);

const jobs = [
  { from: 'apps/viewer/src', to: 'apps/viewer/dist' },
  { from: 'apps/host/src/renderer', to: 'apps/host/dist/renderer' },
  { from: 'apps/host/assets', to: 'apps/host/dist/assets' }
];`,
      explanation:
        'TypeScript only writes `.js` and `.d.ts` files. This list tells the copy step which extensions to carry over and where each folder goes.',
    },
  ],

  concepts: [
    {
      name: 'pnpm workspaces',
      level: 'Core',
      explanation:
        'One repo with many packages that link to each other on disk. `workspace:*` means "use the copy in this repo", not one from a registry.',
      resources: [
        { title: 'pnpm: Workspaces', url: 'https://pnpm.io/workspaces' },
        {
          title: 'pnpm: onlyBuiltDependencies',
          url: 'https://pnpm.io/settings#onlybuiltdependencies',
        },
      ],
    },
    {
      name: 'TypeScript project references',
      level: 'Core',
      explanation:
        '`tsc -b` builds several TypeScript projects in dependency order and skips the ones that did not change.',
      resources: [
        {
          title: 'TypeScript: Project References',
          url: 'https://www.typescriptlang.org/docs/handbook/project-references.html',
        },
      ],
    },
    {
      name: 'Node test runner',
      level: 'Concept',
      explanation: '`node --test` finds and runs test files with no extra package.',
      resources: [{ title: 'Node.js: test runner', url: 'https://nodejs.org/api/test.html' }],
    },
    {
      name: 'ES modules in Node',
      level: 'Concept',
      explanation:
        '`"type": "module"` makes `.js` files ES modules, which is why scripts use `import`.',
      resources: [
        { title: 'Node.js: ECMAScript modules', url: 'https://nodejs.org/api/esm.html' },
      ],
    },
    {
      name: 'File copying',
      level: 'Concept',
      explanation:
        '`fs.cp` copies files and folders recursively, which is all the static copy step needs.',
      resources: [
        {
          title: 'Node.js: fs.cp',
          url: 'https://nodejs.org/api/fs.html#fspromisescpsrc-dest-options',
        },
      ],
    },
  ],

  bugs: [],

  quiz: [
    {
      question: 'Why does the build run `copy-static.mjs` after `tsc -b`?',
      answer:
        'TypeScript only outputs `.js` and `.d.ts` files. HTML, CSS and images would be missing from `dist` without the copy step.',
    },
    {
      question:
        'What stops a random dependency from running code on your machine during `pnpm install`?',
      answer:
        'pnpm 10 skips install scripts unless the package is listed in `onlyBuiltDependencies`. Only `electron` is listed.',
    },
    {
      question: 'What does `"files": []` plus `"references"` in the root `tsconfig.json` do?',
      answer:
        'The root project compiles nothing itself. It only tells `tsc -b` which projects to build, in order.',
    },
  ],

  commits: [
    'chore: add pnpm workspace and root manifest',
    'chore: add strict typescript base config',
    'chore: add build and clean scripts',
    'docs: add project docs, readme and policies',
  ],
});
