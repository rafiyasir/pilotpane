# Spec 017: Keep host from sleeping

Status: Done | Package(s): host, docs | Depends on: 009, 016

Part of v0.4, "Quality and reliability". Spec 009 added the `KeepAwake` interface and an Electron `powerSaveBlocker` implementation, and the controller already calls `start()` once the peer connection is up and `stop()` when the viewer leaves. This spec makes that rule exact, testable and free of gaps.

## Goal

While a viewer is paired, the host laptop does not turn its display off or go to sleep on its idle timer, so the viewer is never left with a frozen picture. When nobody is connected, the host sleeps normally.

## Scope

- In: hold the block for the whole life of a paired viewer (from pairing until it leaves, is kicked, or the host pauses or quits), not only once the peer connection is `connected`; release it as soon as no viewer is left; one small policy module with tests; log each hold and release.
- Out: stopping a lid-close or a manual Sleep (Windows power plan decides that, and spec 016 already recovers from it); waking a sleeping host; a settings toggle or any new UI (Settings screen is "Not designed" in DESIGN.md, so the behaviour is always on); any protocol change.

## Screens

No screens. Behaviour only, nothing new in the host window.

## Protocol messages

None. `PROTOCOL_VERSION` is unchanged.

## Design (SOLID)

- `platform/keep-awake.ts` (existing interface) and `platform/electron-keep-awake.ts` (existing): unchanged, both stay safe to call twice.
- New `awake-guard.ts` in `apps/host/src/main`: one job, decide when the block is held. `AwakeGuard(keepAwake, log)` with `viewerPaired()`, `viewerGone()` and `dispose()`. Idempotent, holds iff a viewer is present, never imports Electron, so it runs under `node --test` with a fake `KeepAwake`.
- `controller.ts`: creates the guard from `opts.keepAwake`; calls `viewerPaired()` in `onViewerPaired`, `viewerGone()` in `onViewerGone`, `dispose()` on quit. The direct `keepAwake.start()` on `connection: connected` and the two direct `stop()` calls are removed.
- Pause: the controller already ends the viewer on pause, so `onViewerGone` releases the block. A test in the guard covers a gone-then-paired sequence.
- Suspend from spec 016: the viewer socket closes, `onViewerGone` fires, the block is released, and the next pairing or resume takes it again.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `feat(host): add AwakeGuard` — `awake-guard.ts` with tests (starts on paired, stops on gone, double calls are single start and stop, gone before paired is a no-op, dispose releases).
2. `refactor(host): hold keep-awake for the whole paired viewer` — wire the guard into `controller.ts`, remove the direct calls.
3. `docs: document keep-awake` — `ARCHITECTURE.md` data-flow note, `ROADMAP.md` row to Done at PR time.

## Done when

- [ ] With a viewer paired, `powercfg /requests` lists PilotPane (Electron) under DISPLAY, from pairing onward, including before video starts.
- [ ] With the viewer closed, kicked, or sharing paused, the entry is gone within a second.
- [ ] A viewer that drops and resumes does not leave a second hold; releasing once releases fully.
- [ ] `AwakeGuard` tests pass under plain `node --test` with no Electron import.
- [ ] No change to the protocol, the LAN binding or the `Host`/`Origin` checks.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` are clean.

## Manual test guide

- **Host (Git Bash):** `pnpm start`. Note the address and PIN. Open an admin PowerShell or Command Prompt and keep it ready for `powercfg /requests`.
- **Viewer (Windows 8 / Chrome 109 laptop):** open `http://<host address>:7420/`.

1. Before pairing, run `powercfg /requests` on the host. DISPLAY should not list PilotPane or Electron.
2. Type the PIN on the viewer. Right after the PIN is accepted, run `powercfg /requests` again. DISPLAY lists `PilotPane.exe` (`electron.exe` from source) with "Chromium" as the reason. The host log shows `[awake] keeping the display awake`.
3. Leave the viewer streaming and the host untouched for longer than the host's display timeout (or set it to 1 minute in Settings > System > Power). The host display stays on and the picture keeps moving.
4. Close the viewer tab. Within a second, `powercfg /requests` no longer lists it, and the log shows `display may sleep again`.
5. Pair again, then click "Pause" in the host window. The entry disappears. Resume sharing and pair again: it comes back once, not twice.
6. Pair again, then click "New PIN" or choose Quit from the tray. The entry disappears.

- **Expected results:** the entry exists exactly while a viewer is paired, and the log shows one hold per pairing.
- **Failure case:** with a viewer paired, put the host to sleep from the Start menu. The viewer keeps the last frame and retries (spec 016). After the host wakes, it resumes without a PIN and `powercfg /requests` lists PilotPane again. Also try a wrong PIN: no entry appears, because nothing paired.
