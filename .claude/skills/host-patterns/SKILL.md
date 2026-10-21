---
name: host-patterns
description: Shapes for PilotPane host code (Electron main process, IPC, logger, injected services, ScreenCapturer and InputInjector). Use when editing apps/host.
---

# Host patterns

## Module shape (main process)

One responsibility per module: `net/`, `pairing`, `session`, `controller`, `windows`, `tray`, `settings`.
`net/`, `pairing` and `session` never import `electron`, so they run under plain `node --test`.
Take time, randomness and I/O as constructor arguments with defaults:

```ts
export class Pairing {
  constructor(private readonly now: () => number = Date.now) {}
}
```

Tests pass a fake `now`; no real timers in tests.

## Services and the controller

`controller.ts` is the only place that wires services together; they never reach for each other through globals.

```ts
const pairing = new Pairing();
const sessions = new ViewerSessions({ pairing, send, log });
const server = new LanServer({ viewerDir, protocolDir, onConnection: sessions.attach });
```

Add a new service as a class with a small constructor-injected options object, then build it in the controller.

## Interfaces for platform parts

Platform-specific work sits behind an interface so a macOS or Linux host replaces only the implementation:

```ts
export interface ScreenCapturer {
  pickPrimary(): Promise<CaptureSource | null>;
  serveDisplayRequests(isAllowed: (frameUrl: string) => boolean): void;
}
export interface KeepAwake {
  start(): void;
  stop(): void;
}
export interface InputInjector {
  inject(event: InputEvent): void; // v0.2: backed by the C# SendInput helper over stdin
  dispose(): void;
}
```

Interfaces live in `apps/host/src/main/platform/`, are built in `main.ts` and passed in `ControllerOptions`. State changes go through `HostStateStore.patch()`. Controller code depends on the interface, never on `desktopCapturer` or the helper process directly.

## IPC through the preload bridge

Renderers get only `window.pilotpane` (see `preload.cts`). To add a call: type it in
`packages/protocol/src/host-internal.ts` (`PilotpaneBridge`, `HostAction`), add it to the preload, handle it in main.
Main must check the sender of every message:

```ts
ipcMain.on('pp:act', (event, action: HostAction) => {
  if (!this.isOurWindow(event.sender.id, [this.hostWindow, this.pinWindow])) return;
  this.handleAction(action);
});
```

Windows use `contextIsolation: true`, `sandbox: true`, load `app://bundle/...`, and the engine window keeps
`backgroundThrottling: false`. Never enable `nodeIntegration`.

## Logging and errors

```ts
const log = createLogger('session'); // PILOTPANE_LOG=debug for more
log.warn('viewer sent a bad message');
```

Never log the PIN, proofs or tokens. Never use bare `console.log`. A bad viewer gets a message or a closed socket,
never a crashed host: parse with the protocol package, drop what fails.

## Network rules to keep intact

Private LAN addresses only (never `0.0.0.0`); `Host` and `Origin` checked on every request and upgrade.
