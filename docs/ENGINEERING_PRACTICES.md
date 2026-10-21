# Engineering practices

The short rules per package. `CLAUDE.md` holds the dependency policy and security rules; this file holds the working habits.

## Protocol (packages/protocol)

- Every network message has a type in `messages.ts` and a validator in `parse.ts`, with a test. Nothing else calls `JSON.parse` on network input.
- Runs in Node and Chrome 109: ES2020 target, no `node:` imports outside `*.test.ts`.
- Parsers return a result or a clear reason; they never throw on bad input.
- Changing a message shape bumps `protocol` and gets a `DECISIONS.md` entry.

## Host main process (apps/host/src)

- One responsibility per module: `net/`, `pairing`, `session`, `controller`, `windows`, `tray`.
- Electron imports stay out of `net/`, `pairing` and `session`, so they run under plain `node --test`.
- Listen on private LAN addresses only, check `Host` and `Origin` on every request and upgrade.
- Fail closed: a bad viewer gets a message or a closed socket, never a crashed host.
- Log through `createLogger(scope)`; never log the PIN, proofs or tokens.

## Host renderers (engine, host window, PIN window)

- `contextIsolation` and `sandbox` on; the only bridge is `window.pilotpane` from the preload.
- Main validates the sender of every IPC message.
- UI windows load from `app://bundle/`, not from the LAN server.
- The engine window keeps `backgroundThrottling` off so a hidden window keeps streaming.
- UI copy is plain English, short, and never blames the user. No em dashes.

## Viewer (apps/viewer)

- ES2020 output, no bundler, no framework, only APIs Chrome 109 has.
- Plain HTTP means no secure-context APIs. Check `window.isSecureContext` first and keep a fallback.
- Themes come from `theme.css` tokens; no hard-coded colours in components.
- Every state is handled: connecting, PIN entry, locked, streaming, reconnecting, error.

## Testing scope

- Unit tests for protocol parsers and for host modules that run without Electron (`net/`, `pairing`, `session`).
- No snapshot tests. Electron windows and the viewer UI are checked by hand with the manual test steps from each spec.
- `pnpm test` builds first, then runs `node --test` on the compiled `*.test.js`. Run it once before a PR, not after every edit.

## Git

- Long-lived branches: `main` (releases only) and `dev` (integration). Nobody commits to them directly.
- Work branches start from `dev`: `spec/NNN-slug` per spec, `fix/short-name` for bugs, `docs/short-name` for docs.
- Conventional commits with scope: `feat(host): ...`, `fix(viewer): ...`, `test(protocol): ...`, `docs: ...`, `chore: ...`. Lowercase, imperative, under 72 characters.
- Logical commits: one concern each; never `git add .` blindly.
- Pull requests are opened and merged by the maintainer by hand. Merge into `dev` with "Rebase and merge" so history stays linear.
- Tag `spec-NNN-done` on `dev` after each spec merges. The journal's Commits section links the range between two of these tags.
- Releases: merge `dev` into `main` with a merge commit, tag `vX.Y.Z`, update `CHANGELOG.md`.
- No AI attribution in commits, PR text or docs.
