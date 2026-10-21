# Spec 009: Host interfaces and smaller services

Status: Done | Package(s): host | Depends on: 005, 007, 008

Part of v0.2, "Mouse and low bandwidth". A refactor with no behaviour change: it prepares the host for input injection (010, 011).

## Goal

`controller.ts` (about 390 lines) stops doing everything. Platform parts sit behind interfaces and state lives in a small testable service, so spec 010 can add an `InputInjector` without touching capture code.

## Scope

- In: `ScreenCapturer`, `InputInjector` (interface plus a no-op implementation) and `KeepAwake` interfaces with Electron-backed implementations; a pure `HostStateStore`; the controller depends on the interfaces and receives them through its options.
- Out: the C# helper (010), any input messages (011), new UI, any change to pairing, session or network code, multi-monitor choice.

## Screens

No screens.

## Protocol messages

None. `HostState`, `EngineCommand` and `EngineEvent` keep their shapes, so `protocol` is not bumped.

## Design (SOLID)

- Interfaces (in `apps/host/src/main/platform/`):
  - `ScreenCapturer { pickPrimary(): Promise<CaptureSource | null> }` where `CaptureSource = { id: string; name: string }`. Today's `pickScreen` and the `setDisplayMediaRequestHandler` wiring move into `ElectronScreenCapturer` (`electron-capturer.ts`).
  - `InputInjector { inject(event: unknown): void; dispose(): void }`, with `NullInputInjector` (drops events, logs once at debug). The event type is narrowed to the real `InputEvent` in 011.
  - `KeepAwake { start(): void; stop(): void }` with `ElectronKeepAwake` over `powerSaveBlocker`; start is idempotent.
- New modules, one job each:
  - `host-state.ts`: `HostStateStore` holds `HostState`, `patch()` merges and notifies subscribers. No Electron import, so it runs under `node --test`.
  - `platform/*`: the Electron-bound implementations above. Only these files import `desktopCapturer`, `screen`, `session` (display media) or `powerSaveBlocker`.
- Injected: `ControllerOptions` gains `capturer`, `injector`, `keepAwake`; `main.ts` builds the Electron versions. The controller subscribes windows and tray to the store instead of looping over windows inside `patch`.
- `net/`, `pairing` and `session` stay untouched.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `refactor(host): add HostStateStore` with tests; controller uses it for state and window/tray updates.
2. `refactor(host): add ScreenCapturer and move screen picking behind it`.
3. `refactor(host): add KeepAwake interface and Electron implementation`.
4. `feat(host): add InputInjector interface and NullInputInjector` with a test; wired in the controller (disposed on shutdown), not yet called.
5. `docs: note the platform interfaces in ARCHITECTURE.md` (extension points) and update `host-patterns` if the shapes differ.

## Done when

- [x] `controller.ts` no longer imports `desktopCapturer`, `screen` or `powerSaveBlocker`.
- [x] `HostStateStore` tests cover patch merging, subscriber calls and unsubscribe, and pass under plain `node --test`.
- [x] `NullInputInjector` tests: `inject` does not throw, `dispose` is safe to call twice.
- [x] `pnpm format:check`, `pnpm build` and `pnpm test` pass.
- [x] Behaviour is unchanged: pair, see the screen, switch 1080p/720p, Pause/Resume, New PIN, quit all work as in v0.1.

## Manual test guide

No behaviour should change, so this is a v0.1 regression pass.

- **Host (Git Bash):** `PILOTPANE_LOG=debug pnpm start`. The big PIN screen and host window appear.
- **Viewer (Windows 8 / Chrome 109):** open `http://<host address>:7420` and enter the PIN.
  - The host screen appears; the host window shows the viewer, duration and stats.
  - Click 720p, then 1080p, in the toolbar: the size in the stats changes within 3 s.
  - The host log shows `capturing "<screen name>"`.
- **Pause and PIN:** in the host window click Pause. The viewer is disconnected and the address stops answering. Click Resume, then New PIN, and pair again with the new PIN.
- **Keep awake:** while streaming, the host display does not dim or sleep (set a 1 minute screen timeout to check).
- **Quit** from the tray: the viewer shows that the host stopped and the process exits.
- **Failure case:** start another program on port 7420 first (for example `node -e "require('net').createServer().listen(7420)"` in a second Git Bash), then `pnpm start`. The host window shows "Port 7420 is already in use" with the option to use the next port.
