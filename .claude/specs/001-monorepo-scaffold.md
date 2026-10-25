# Spec 001: Monorepo scaffold

Status: Done | Package(s): all | Depends on: none

Part of v0.1, "See the screen". Reconstructed from the original v0.1 spec after it was split; the acceptance criteria (AC-N) are the ones from that spec.

## Goal

A pnpm workspace where strict TypeScript builds every project and the dependency policy is enforced by tooling.

## Scope

- In: pnpm workspaces, strict TypeScript project references, `pnpm build/test/start/clean`, static-file copy script, install scripts blocked except Electron.
- Out: Any feature code, CI, formatting.

## Screens

No screens.

## Protocol messages

None.

## Design (SOLID)

- `scripts/copy-static.mjs` and `scripts/clean.mjs`: plain Node, one job each, no packages.
- Nothing is injected.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. Workspace, tsconfig base and project references
2. Build, test, clean and copy-static scripts
3. Contributor and policy docs

## Done when

- [x] `pnpm install && pnpm build && pnpm test` succeed on Windows 11 in Git Bash (AC-1).
- [x] Only Electron may run an install script (`pnpm-workspace.yaml`).
- [x] Runtime dependencies outside the repo: none besides Electron.

## Manual test guide

- **Host (Git Bash):** `pnpm install && pnpm build && pnpm test`
- **Viewer (Windows 8 / Chrome 109):** Nothing to open.
- **Failure case:** Add a package that wants an install script; pnpm skips it with a warning.
