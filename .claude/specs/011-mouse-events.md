# Spec 011: Mouse events and pointer lock

Status: Done | Package(s): protocol, host, viewer | Depends on: 005, 009, 010

Part of v0.2, "Mouse and low bandwidth". First spec where the viewer controls the host. Keyboard is 013.

## Goal

On the viewer, moving the mouse over the picture moves the pointer on the host, and clicks and the wheel work. Clicking the picture locks the pointer inside it; Esc lets go.

## Scope

- In: a WebRTC data channel for input, mouse move, button and wheel messages with a parser, mapping to `InputCommand`, rate limiting, releasing held buttons when control ends, an `input-state` message so the viewer knows whether the host can inject, pointer lock with a fallback, the hint and badge from the "Mouse hint" canvas.
- Out: keyboard (013), touch or touchpad mode, multi-monitor (primary screen only), clipboard, UAC secure desktop.

## Screens

"Mouse and pointer lock hint" (canvas: Mouse hint), Confirmed. Five states: first hint, Controlling, Released, Pointer lock missing, Host has no input. No other new UI.

## Protocol messages

Viewer to host, over the data channel only (never the WebSocket, `CLAUDE.md` security rule). Each is a JSON text message, max 128 bytes, parsed by `parseInputMessage` in `packages/protocol/src/parse.ts`.

| Type           | Fields                                      | Limits                                       |
| -------------- | ------------------------------------------- | -------------------------------------------- |
| `mouse-move`   | `x`, `y`                                    | integers 0..65535 (primary screen, absolute) |
| `mouse-button` | `button`: left, right, middle; `down`: bool |                                              |
| `mouse-wheel`  | `dx`, `dy`                                  | integers -100..100 notches                   |

Host to viewer, over the WebSocket after pairing (a capability flag, not input): `input-state { available: boolean }`, with a parser and test.

Existing messages keep their shape, so `PROTOCOL_VERSION` is not bumped. An old viewer drops `input-state`. `EngineEvent` gains `{ evt: 'input'; msg: InputMessage }` (host-internal).

## Design (SOLID)

- Interface change: `InputInjector` gains `readonly available: boolean` (`false` for Null) and `releaseAll()` (buttons up). `HelperInputInjector` implements `releaseAll` with its existing held-state tracking.
- New modules, one job each:
  - `packages/protocol/src/input.ts`: `InputMessage` types and `parseInputMessage()`. Runs in Node and Chrome 109.
  - `apps/host/src/main/input-bridge.ts`: turns an `InputMessage` into an `InputCommand`, drops moves beyond 250 per second (buttons and wheel are never dropped), calls the injector, `releaseAll()` on `end()`. Pure; takes the injector and a clock. No Electron.
  - `apps/viewer/src/pointer.ts`: maps pointer position to 0..65535 inside the visible video rectangle (letterbox aware), sends at most one move per animation frame, handles pointer lock (`requestPointerLock` when available, else plain `mousemove`), and the Controlling and Released states. No UI markup.
- Existing modules touched lightly: `engine.ts` creates the `input` data channel next to the video track and forwards parsed messages as `EngineEvent`; `controller.ts` builds the bridge, ends it when the viewer leaves or the connection drops, and sends `input-state` via `session.ts`; `receiver.ts` exposes the channel; `main.ts` (viewer) shows the hint states.
- Parsing happens in the engine window with `parseInputMessage` (no `JSON.parse` elsewhere). Main re-checks the value with `formatCommand` before injecting, because renderer values are untrusted.
- Pointer lock needs a user gesture and works on plain HTTP in Chrome 109, but check `document.pointerLockElement` support and fall back to unlocked mouse with the "Pointer lock missing" card.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `feat(protocol): add input messages and input-state` with parser tests (valid, wrong type, missing field, float, out of range, oversized, unknown button).
2. `feat(host): add available and releaseAll to InputInjector` with tests for Null and Helper.
3. `feat(host): add input bridge` with tests (mapping, move rate limit, buttons never dropped, releaseAll on end, Null injector).
4. `feat(host): open the input data channel` in `engine.ts`, new `EngineEvent`, controller wiring, `input-state` after pairing, end on viewer leave or drop.
5. `feat(viewer): send mouse input` with `pointer.ts`, receiver channel hookup, coordinate mapping tests for letterbox cases (pure function, `node --test`).
6. `feat(viewer): add mouse hint and Controlling badge` for the five states, all themes, `localStorage` for "seen" wrapped in try/catch.
7. `docs: document mouse input`: ARCHITECTURE messages table and data channel, ADR-013 (input on one ordered data channel with absolute coordinates, coalesced moves), `viewer-patterns` and `host-patterns` if shapes differ, manual test guide.

## Done when

- [x] `parseInputMessage` rejects every malformed or out-of-range case and never throws; tests pass under plain `node --test`.
- [x] No input message is read from or sent over the WebSocket; `JSON.parse` of network input exists only in `packages/protocol`.
- [x] `input-bridge` tests pass with no Electron: moves above 250 per second are dropped, buttons and wheel are not, `end()` releases held buttons.
- [x] Mouse move, left, right, middle click and wheel on the viewer act on the host's primary screen at the right place, including when the video is letterboxed.
- [x] Clicking the picture locks the pointer; Esc releases it and the badge changes between "Controlling" and "Viewing".
- [x] When the viewer disconnects or the page closes while a button is held, the button is released on the host.
- [x] Without the helper exe the viewer shows "Watching only" and the host does not crash.
- [x] The viewer stays ES2020 and Chrome 109 safe, with `isSecureContext` checks where needed; UI uses only existing tokens in all four themes.
- [x] `pnpm format:check`, `pnpm build`, `pnpm test` and `pnpm scan` pass.

## Manual test guide

Needs both laptops on one network (see docs/CONNECTIONS.md). Before you start, open something harmless on the host, for example Notepad and an empty desktop, and keep the host screen visible so you can see the pointer move.

**Host (Git Bash)**

1. `pnpm build`. Expect `built apps/host/dist/helper/pilotpane-input.exe`.
2. `PILOTPANE_LOG=debug pnpm start`. Expect the big PIN screen and a log line `input helper ready` after the first mouse event.

**Viewer (Windows 8 / Chrome 109 laptop)**

3. Open the address the host shows, type the PIN. The picture appears. Expect: the toolbar badge (open the toolbar with the tab at the top) reads **Viewing**, and a card at the bottom says "Click the screen to control it. Press Esc to let go."
4. Click the picture once. Expect: the card goes away, an amber outline appears around the picture, the badge reads **Controlling**, and a small pill says "Esc to let go". The viewer's pointer disappears (locked). Nothing is clicked on the host by this first click.
5. Move the mouse. Expect: the pointer on the host moves the same way, with no visible lag on a router or cable. Move it to each corner of the picture; the host pointer reaches the matching corner.
6. Left-click an icon or window on the host, double-click to open it, right-click for a menu, scroll in a long window (Notepad with many lines), drag a window by its title bar. Expect each to happen on the host.
7. Press Esc. Expect: the outline goes, the badge reads **Viewing**, a pill says "Click to control again." and your own pointer returns. Click the picture again to take control back.
8. Hold the left mouse button over the host desktop (drag a selection box), then press Esc. Expect: the selection ends, no button stays held on the host.
9. Reload the viewer page and connect again. Expect: no first-time card this time (it is shown only until you take control once). To see it again, clear site data for the page.
10. Pick **720p** in the toolbar while controlling. Expect: mouse control keeps working.

**Failure cases**

- **No helper:** close PilotPane. Rename `apps/host/dist/helper/pilotpane-input.exe` to `.bak`, then start with `pnpm --filter @pilotpane/host start` (this skips the build). Connect from the viewer. Expect: the badge reads **Watching only**, a card says "Control is not available on this host. You can still watch the screen.", clicking the picture does nothing, the picture keeps streaming, and the host log shows one warning. Rename the file back afterwards.
- **Network drop while holding:** hold the left button on the host desktop through the viewer, then unplug the cable or turn off the viewer's network. Expect: within a few seconds the host button is released (the selection ends) and the viewer shows "Reconnecting". After it reconnects, click the picture to control again.
- **Pointer lock refused:** press Esc right as you click the picture (or use a browser without pointer lock). Expect: a card "Your mouse still works. This browser cannot lock the pointer, so it can leave the window." Control still works with the plain mouse and Esc still releases it.
- **Other viewer:** with one viewer connected and controlling, open the page on a second device. Expect "Someone else is connected" and the first viewer is unaffected.

Not covered here: keyboard (spec 013), touch and multi-monitor.
