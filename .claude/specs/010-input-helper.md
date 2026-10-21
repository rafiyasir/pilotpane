# Spec 010: Own C# SendInput helper behind InputInjector

Status: Done | Package(s): host | Depends on: 009

Part of v0.2, "Mouse and low bandwidth". Implements ADR-003. No viewer or network messages yet (011 adds them).

## Goal

The host can move the mouse, click, scroll and press keys on Windows through a tiny helper program we compile ourselves, driven by a documented text protocol. A developer can prove it works with a demo script, before any viewer is involved.

## Scope

- In: C# source for `pilotpane-input.exe` (Win32 `SendInput`), a build script that compiles it with the .NET Framework `csc.exe` that ships with Windows, a pure formatter for the stdin protocol, `HelperInputInjector` (spawns and feeds the helper), wiring in `main.ts` with fallback to `NullInputInjector`, a demo script for the manual test.
- Out: viewer mouse or keyboard events and pointer lock (011, 013), protocol messages, mapping viewer coordinates to the screen (011), multi-monitor, the UAC secure desktop (Windows forbids it), any UI.

## Screens

No screens.

## Protocol messages

None on the network. The helper's stdin protocol is internal and documented in `apps/host/helper/PROTOCOL.md`; `protocol` is not bumped.

## Design (SOLID)

- `InputInjector.inject` is narrowed from `unknown` to `InputCommand` (host-internal type in `platform/input-command.ts`):
  `move { x, y }` (0..65535 across the primary screen), `button { button: left|right|middle, down }`, `wheel { dx, dy }` (notches), `key { vk, down }`.
- Helper stdin protocol: one ASCII line per command, e.g. `M 32768 32768`, `B L 1`, `W 0 -1`, `K 65 1`. The helper prints `ready` once on stdout, ignores and logs (stderr) any malformed line, never crashes on one, and exits when stdin closes, so it dies with the host.
- New modules, one job each:
  - `platform/input-command.ts`: the `InputCommand` type and `formatCommand()`, which validates ranges and returns the line or `null`. No Electron, no `node:` spawn.
  - `platform/helper-input-injector.ts`: `HelperInputInjector implements InputInjector`. Spawns the helper through an injected `spawn` function, waits for `ready`, writes lines, releases any held buttons and keys on `dispose()`, logs and drops commands if the helper dies (never throws into the host). Restarts at most once.
  - `apps/host/helper/InputHelper.cs` and `scripts/build-helper.mjs`: source and its compile step (plain Node, finds `csc.exe` under `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319`, output `apps/host/dist/helper/pilotpane-input.exe`).
- Injected: `HelperInputInjector` receives `spawn` and the exe path; `main.ts` builds it and falls back to `NullInputInjector` when the exe is missing (logged at warn). The controller already disposes the injector on shutdown.
- `net/`, `pairing` and `session` stay untouched. Nothing here listens on a socket.

## New dependencies

None. `csc.exe` is part of Windows; no SDK, no npm package, no Visual Studio.

## Tasks (each task = one logical commit)

1. `feat(host): add InputCommand type and formatCommand` with tests (valid lines, out-of-range and unknown values return null); narrow `InputInjector.inject` and `NullInputInjector`.
2. `feat(host): add C# SendInput helper and build script`: `InputHelper.cs`, `PROTOCOL.md`, `scripts/build-helper.mjs`, run from `pnpm build` after `tsc -b`; `pnpm clean` removes the exe. Skips with a clear message on non-Windows.
3. `feat(host): add HelperInputInjector` with tests using a fake spawn (writes lines after `ready`, drops before ready, releases held buttons on dispose, survives helper exit, restarts once).
4. `feat(host): use the helper injector when available`: wire in `main.ts` with the Null fallback.
5. `chore(host): add input demo script`: `scripts/input-demo.mjs` moves the cursor in a square, left-clicks the empty desktop corner-free spot, scrolls once.
6. `docs: document the input helper`: ARCHITECTURE.md extension point, `host-patterns` skill if shapes differ, ROADMAP row.

## Done when

- [x] `formatCommand` tests cover every command type, boundary values (0, 65535) and rejected input (negative, NaN, unknown button, huge `vk`).
- [x] `HelperInputInjector` tests pass under plain `node --test` with no Electron and no real process.
- [x] `pnpm build` produces `apps/host/dist/helper/pilotpane-input.exe` on Windows with no extra installs, and does not fail on a machine without `csc.exe` (warns, host falls back to Null). It also does not fail while the host is running and holds the exe: it warns and keeps the existing build.
- [x] The helper survives a malformed line, and exits within a second of stdin closing.
- [x] Held buttons and keys are released when the injector is disposed or the helper is restarted.
- [x] `controller.ts` and `net/` do not import the helper or `child_process`.
- [x] `pnpm format:check`, `pnpm build` and `pnpm test` pass.
- [x] Docs and the `host-patterns` skill match the code.

## Manual test guide

Host only, since no viewer messages exist yet. The viewer laptop is not needed.

1. **Build (Git Bash):** `pnpm build`. Expect the line `built apps/host/dist/helper/pilotpane-input.exe`.
2. **Demo (Git Bash):** `node scripts/input-demo.mjs`, then do not touch the mouse for about 8 seconds.
   Expect: the cursor visits four corners of a square (a quarter in from each screen edge) and returns to the start, the console prints five `move` lines and `done`. A middle click and one scroll step happen at the end, so run it with a harmless window under the cursor.
3. **No leftover process (Git Bash):** `tasklist | grep -i pilotpane-input` prints nothing.
4. **Malformed input (Git Bash):** `printf 'garbage\nM 99999 1\n' | apps/host/dist/helper/pilotpane-input.exe`.
   Expect: `ready`, then `ignored: garbage` and `ignored: M 99999 1`, and the program exits by itself.
5. **Host still works (Git Bash):** `PILOTPANE_LOG=debug pnpm start`. Expect the usual PIN screen and, in the log, `input helper ready` once a command is sent (none yet, so the helper simply sits idle). Pairing and streaming behave as in v0.1.

- **Failure case:** rename `apps/host/dist/helper/pilotpane-input.exe` to `.bak` and run `pnpm --filter @pilotpane/host start` (this skips the build, which would recreate the exe). The host starts normally and the log shows one warning, `input helper not found, mouse and keyboard control is off`. Rename it back afterwards (or run `pnpm build`).
