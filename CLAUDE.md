# CLAUDE.md: working on PilotPane

@docs/OVERVIEW.md
@docs/ARCHITECTURE.md
@docs/CONNECTIONS.md
@docs/DECISIONS.md
@docs/ENGINEERING_PRACTICES.md
@docs/DEPLOYMENT.md
@docs/ROADMAP.md
@docs/SECURITY_NOTES.md
@docs/PUBLIC_PRIVATE.md
@DESIGN.md

Guidelines for anyone (human or AI) writing code in this repo. Read this before every spec. Read a reference doc only when the task touches it. Patterns with code shapes: `.claude/skills/protocol-patterns`, `host-patterns`, `viewer-patterns`.

## What this is

A LAN-only remote screen for Windows. The **host** (Electron) captures the screen and serves a **viewer** web page; the viewer pairs with a PIN and receives the screen over WebRTC. Specs live in `.claude/specs/`, decisions in `docs/DECISIONS.md`, architecture in `docs/ARCHITECTURE.md`.

## Dependency policy (strict)

We build the features ourselves. A dependency is allowed only if it is:

1. the platform itself (Node built-ins, Electron, browser APIs), or
2. an official tool from a major organization, used at **dev time only** (TypeScript, `@types/node`).

Everything else is written in this repo. Before adding any package:

- It must have an OSI open-source license, no subscription, no private registry, no account.
- No unknown single-maintainer packages. No install scripts (pnpm blocks them; only `electron` is allowlisted in `pnpm-workspace.yaml`).
- Add an entry to `docs/DECISIONS.md` explaining why it is worth it.

If in doubt, write it. Current runtime dependencies outside the repo: **none** besides Electron.

## Commands

```bash
pnpm install          # once
pnpm build            # tsc -b for all projects + copy static files
pnpm test             # build, then node --test on compiled *.test.js
pnpm start            # build and launch the host
pnpm clean
pnpm format           # Prettier (dev only), rewrites files
pnpm format:check     # what CI runs
pnpm setup-hooks      # once per clone: enables the .githooks/commit-msg check
```

Developed on Windows 11 with Git Bash. Commands must work in Git Bash and PowerShell. No Docker.

## Code rules

- TypeScript `strict` everywhere, plus `noUncheckedIndexedAccess`. No `any`; use `unknown` and narrow.
- **Every network message** goes through `packages/protocol`: add the type to `messages.ts` and validation to `parse.ts`, with a test. Never `JSON.parse` network input anywhere else.
- `packages/protocol` must run in Node **and** Chrome 109: no `node:` imports outside `*.test.ts`, target ES2020.
- **Viewer** (`apps/viewer`): ES2020 output, no bundler, no framework. Only browser APIs that Chrome 109 has. Plain HTTP means **no secure-context APIs** (`crypto.subtle`, async Clipboard, Keyboard Lock); check `window.isSecureContext` before using any of them, with a fallback.
- **Host main process**: one responsibility per module (`net/`, `pairing`, `session`, `controller`, `windows`, `tray`). Electron imports stay out of `net/`, `pairing` and `session` so they can be unit tested in plain Node.
- **Renderers**: `contextIsolation` and `sandbox` on, talk to main only through `window.pilotpane` (preload). Validate the sender of every IPC message in main.
- UI copy is plain English, short, and never blames the user. No em dashes.
- Use the logger (`createLogger(scope)`), not bare `console.log`, in the host.
- Errors: fail closed. Reject bad input with a clear message; never crash the host on a bad viewer.

## Security rules

- Listen only on private LAN addresses, never `0.0.0.0`.
- Check `Host` and `Origin` on every request and WebSocket upgrade.
- The PIN never travels on the network; only `pinProof(nonce, pin)` does.
- Input injection (v0.2+) travels only over the WebRTC data channel (encrypted), never over the WebSocket.
- Nothing personal in code, docs, fixtures or screenshots: no real IPs except documentation examples, no hostnames, no names other than the author credit.

## Workflow

- Specs first: each piece of work starts from a spec in `.claude/specs/` (template `_TEMPLATE.md`) with testable "Done when" items.
- Lean loop: build to the spec, run `pnpm test`, then write **manual test steps** (exact commands, what to open on the viewer laptop, what should appear). The maintainer tests, then it ships.
- No heavy multi-agent write/review loops.
- The loop: `/create-spec NNN slug` -> `/build NNN` -> you test with the guide -> `/learn NNN` -> `/prepare-pr` -> merge on GitHub ("Rebase and merge") -> `/post-merge`. Optional `/review NNN` for pairing, input and network specs; `/release X.Y.Z` for releases. Start a fresh session (`/clear`) per spec. Setup and troubleshooting: `RUNBOOK.md`.
- Each spec gets a learning-journal page `docs/journal/specs/NNN.js` (data shape in `docs/journal/README.md`), written with `/learn NNN` before the PR and listed in `specs/manifest.js`. `/prepare-pr` marks the spec Done in `docs/ROADMAP.md`.

## Self-check before handing over (run it, do not skip)

1. The spec's "Done when" items are all satisfied.
2. Format, build and tests pass: `pnpm format:check`, `pnpm build`, `pnpm test` (affected tests while working, the full run once at the end).
3. Every network message is typed in `packages/protocol` with a parser and a test; no `JSON.parse` of network input anywhere else.
4. LAN-only binding and the `Host`/`Origin` checks are untouched, or the change is called out and reviewed.
5. The viewer stays ES2020 and Chrome 109 safe; secure-context APIs have an `isSecureContext` check and a fallback.
6. No secrets or personal data (IPs, hostnames, names, paths, screenshots) in the diff.
7. The manual test guide is written in the spec: host steps in Git Bash, viewer steps on the Windows 8 / Chrome 109 laptop, expected results, at least one failure case.
8. The journal page is written with `/learn NNN`.

## Keep it cheap

Read only the files a task needs. Run only affected tests while working and the full `pnpm test` once at the end. Do not re-read files you just wrote or the whole repo. Copy a reference file and edit what differs instead of retyping it. Keep specs small; if a spec grows past a few hundred lines of change, propose splitting it.

## Git

- `main` = releases only. `dev` = integration branch; all work branches start from `dev` and merge back into it.
- Branch names: `spec/NNN-slug`, `fix/<short-name>`, `docs/<short-name>`. Merge PRs into `dev` with "Rebase and merge", then tag `spec-NNN-done`. Details in `docs/ENGINEERING_PRACTICES.md`.
- Commits and PRs carry no AI attribution: no Co-Authored-By, no "Generated with" lines. `.claude/settings.json` and the `.githooks/commit-msg` hook enforce it.
- Never `git add .`: add explicit paths, never anything under `private/`. Never create or merge PRs, never push to `main` or `dev`.
- Small, focused commits in Conventional Commit style (`feat(host): ...`, `fix(viewer): ...`, `docs: ...`, `test: ...`, `chore: ...`).
- The maintainer opens PRs by hand: finish each piece with a copyable **PR title and body** (summary, changes, test steps, checklist).
- After merge: delete the branch, and on a release merge `dev` into `main`, tag `vX.Y.Z`, update `CHANGELOG.md`.

## Public repo hygiene

This repo is public from the first commit. Follow `docs/PUBLIC_PRIVATE.md`. Personal notes and drafts go in `private/` (gitignored).
