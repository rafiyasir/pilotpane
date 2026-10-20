# CLAUDE.md: working on PilotPane

Guidelines for anyone (human or AI) writing code in this repo. Read this before every spec.

## What this is

A LAN-only remote screen for Windows. The **host** (Electron) captures the screen and serves a **viewer** web page; the viewer pairs with a PIN and receives the screen over WebRTC. Specs live in `docs/specs/`, decisions in `docs/decisions.md`, architecture in `docs/architecture.md`.

## Dependency policy (strict)

We build the features ourselves. A dependency is allowed only if it is:

1. the platform itself (Node built-ins, Electron, browser APIs), or
2. an official tool from a major organization, used at **dev time only** (TypeScript, `@types/node`).

Everything else is written in this repo. Before adding any package:

- It must have an OSI open-source license, no subscription, no private registry, no account.
- No unknown single-maintainer packages. No install scripts (pnpm blocks them; only `electron` is allowlisted in `pnpm-workspace.yaml`).
- Add an entry to `docs/decisions.md` explaining why it is worth it.

If in doubt, write it. Current runtime dependencies outside the repo: **none** besides Electron.

## Commands

```bash
pnpm install          # once
pnpm build            # tsc -b for all projects + copy static files
pnpm test             # build, then node --test on compiled *.test.js
pnpm start            # build and launch the host
pnpm clean
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

- Specs first: each piece of work starts from a spec in `docs/specs/` with acceptance criteria.
- Lean loop: build to the spec, run `pnpm test`, then write **manual test steps** (exact commands, what to open on the viewer laptop, what should appear). The maintainer tests, then it ships.
- No heavy multi-agent write/review loops.
- After a spec merges, add a learning-journal entry in `docs/journal/` (template there).

## Git

- `main` = releases only. `dev` = integration branch; all work branches start from `dev` and merge back into it.
- Branch names: `feat/<spec-id>-<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
- Small, focused commits in Conventional Commit style (`feat(host): ...`, `fix(viewer): ...`, `docs: ...`, `test: ...`, `chore: ...`).
- The maintainer opens PRs by hand: finish each piece with a copyable **PR title and body** (summary, changes, test steps, checklist).
- After merge: delete the branch, and on a release merge `dev` into `main`, tag `vX.Y.Z`, update `CHANGELOG.md`.

## Public repo hygiene

This repo is public from the first commit. Follow `docs/public-private.md`. Personal notes and drafts go in `private/` (gitignored).
