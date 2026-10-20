# SPEC 001: Monorepo scaffold

`v0.1` · `package.json` · merged 2026-10-21 · progress 1 of 22 specs

**In one line:** the project got a home where three packages build together with strict TypeScript and no third-party runtime code.

## 1. What we built and where it lives

| Path | What it does | State |
|---|---|---|
| `package.json` | Root scripts: `build`, `test`, `start`, `clean` | Changed |
| `pnpm-workspace.yaml` | Declares `apps/*` and `packages/*`, allows install scripts only for Electron | Changed |
| `pnpm-lock.yaml` | Pins every dependency version | Changed |
| `tsconfig.base.json` | Shared strict compiler settings | Changed |
| `tsconfig.json` | Root project that builds all four TypeScript projects with `tsc -b` | Changed |
| `scripts/` | `copy-static.mjs` copies HTML, CSS and images next to compiled output; `clean.mjs` removes `dist` folders | Changed |
| `docs/`, `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` | Overview, architecture, decisions, spec and the rules for writing code | Changed |
| `apps/`, `packages/` | Empty so far, filled by specs 002 to 007 | Untouched |

## 2. Decisions and the reasons

- **We chose** pnpm 10 workspaces **instead of** npm or yarn, and no Turborepo, **because** pnpm blocks dependency install scripts by default, which enforces the "no third-party packages" rule on its own. `tsc -b` already builds projects in the right order (ADR-006).
- **We chose** to write features ourselves and use only the platform and official dev tools **instead of** `ws`, `express` or bundlers **because** the supply chain stays small and every piece becomes a lesson (ADR-002).
- **We chose** the MIT license **instead of** AGPL or GPL **because** it is the simplest for a learning project that should be easy to reuse (ADR-006).
- **We chose** a small Node script to copy static files **instead of** a bundler **because** the project only has to copy HTML, CSS and images, and Node can do that in 30 lines.

## 3. Where this sits in the journey

- **Built on:** nothing yet. This is the first spec; `main` only holds the license and editor settings.
- **Unlocks:** spec 002 puts the typed protocol in `packages/protocol`, and every later spec adds code that `pnpm build` and `pnpm test` already know how to handle.

## 4. How it works

1. `pnpm install` reads `pnpm-workspace.yaml`, finds the packages under `apps/` and `packages/`, and links them to each other as `workspace:*`.
2. `pnpm build` runs `tsc -b`. The root `tsconfig.json` lists each project as a reference, so TypeScript builds them in dependency order.
3. Right after, `node scripts/copy-static.mjs` copies the files TypeScript ignores (HTML, CSS, PNG) into each `dist` folder.
4. `pnpm test` builds first, then runs Node's built-in test runner on the compiled `*.test.js` files.
5. `pnpm clean` removes the `dist` folders so the next build starts fresh.

## 5. The code that matters

```yaml
packages:
  - apps/*
  - packages/*

# pnpm 10 blocks install scripts of dependencies by default.
# Only Electron may run one (it downloads its own binary).
# Any other package asking to run a script is skipped with a warning.
onlyBuiltDependencies:
  - electron
```

```js
const STATIC = new Set(['.html', '.css', '.png', '.ico', '.svg']);

const jobs = [
  { from: 'apps/viewer/src', to: 'apps/viewer/dist' },
  { from: 'apps/host/src/renderer', to: 'apps/host/dist/renderer' },
  { from: 'apps/host/assets', to: 'apps/host/dist/assets' }
];

async function copyStatic(fromDir, toDir) {
  let count = 0;
```

## 6. Concepts to go deeper

- **Node test runner**: `node --test` finds and runs test files with no extra package. [Node.js: test runner](https://nodejs.org/api/test.html)
- **ES modules in Node**: `"type": "module"` makes `.js` files ES modules, which is why scripts use `import`. [Node.js: ECMAScript modules](https://nodejs.org/api/esm.html)
- **File copying**: `fs.cp` copies files and folders recursively, which is all the static copy step needs. [Node.js: fs.cp](https://nodejs.org/api/fs.html#fspromisescpsrc-dest-options)

## 7. Check yourself

1. Why does the build run `copy-static.mjs` after `tsc -b`?
2. What stops a random dependency from running code on your machine during `pnpm install`?
3. What does `"files": []` plus `"references"` in the root `tsconfig.json` do?

<details>
<summary>Answers</summary>

1. TypeScript only outputs `.js` and `.d.ts` files. HTML, CSS and images would be missing from `dist` without the copy step.
2. pnpm 10 skips install scripts unless the package is listed in `onlyBuiltDependencies`. Only `electron` is listed.
3. The root project compiles nothing itself. It only tells `tsc -b` which projects to build, in order.

</details>

## Bugs I hit

None worth a write-up for this spec.

## Commits

- `chore: add pnpm workspace and root manifest`
- `chore: add strict typescript base config`
- `chore: add build and clean scripts`
- `docs: add project docs, readme and policies`

[Compare main...spec-001-done](https://github.com/rafiyasir/pilotpane/compare/main...spec-001-done)
