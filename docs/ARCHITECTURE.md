# Architecture

## Components

```
                         HOST (Windows, Electron)                                   VIEWER (any browser)
 ┌──────────────────────────────────────────────────────────────────────┐        ┌────────────────────────┐
 │ Main process (Node)                                                  │        │ index.html + main.js    │
 │                                                                      │  HTTP  │                         │
 │  net/http-server.ts  one http.Server per private LAN address  ◄──────┼────────┤  GET /, /main.js,       │
 │     serves apps/viewer/dist and packages/protocol/dist               │        │  /protocol/*.js         │
 │  net/ws.ts           own WebSocket (RFC 6455) on /ws          ◄──────┼── WS ──┤  socket.ts              │
 │  pairing.ts          PIN, nonce, lockout, resume tokens              │        │  PIN form + proof       │
 │  session.ts          hello / pair / signaling relay, 1 viewer        │        │                         │
 │  controller.ts       state, wiring, keep-awake                       │        │  receiver.ts            │
 │  tray.ts, windows.ts                                                 │        │  RTCPeerConnection      │
 │        │ IPC (preload bridge, sender checked)                        │        │  (receive only)         │
 │        ▼                                                             │ WebRTC │                         │
 │  Engine window (hidden renderer)                                     │◄══════►│  <video>                │
 │     desktop capture → RTCPeerConnection (send only, H.264 preferred) │ media  │  stats overlay          │
 │  Host window (option A)  ·  PIN window (option B, full screen)       │        │                         │
 └──────────────────────────────────────────────────────────────────────┘        └────────────────────────┘
```

- **Main process**: everything that needs Node: sockets, pairing, settings, tray, windows.
- **Engine window**: hidden Chromium renderer. Screen capture and WebRTC only exist in Chromium, so they live here. `backgroundThrottling` is off so a hidden window keeps sending frames.
- **Host and PIN windows**: UI only, loaded from `app://bundle/...` (a privileged custom scheme, not the LAN server).
- **Viewer**: static files over plain HTTP from the host. No bundler: modules load directly, and the shared protocol is served at `/protocol/`.

## Data flow: from start to picture

1. Host starts, picks a PIN, lists private IPv4 addresses, listens on `<address>:7420` for each (plus 127.0.0.1 for local tests). Shows the full-screen PIN.
2. Viewer opens `http://<address>:7420/`, then a WebSocket to `/ws`.
3. Host → `hello { protocol, hostName, nonce, appVersion }`.
4. Viewer → `pair { proof }` with `proof = SHA-256("pilotpane-pin:v1:" + nonce + ":" + pin)`.
5. Host verifies. Wrong → `pair-failed { reason, attemptsLeft, retryAfterSec }`. Right → `paired { token }`, closes the PIN window, asks the engine to start.
6. Main picks the primary screen with `desktopCapturer` and sends `start { sourceId, quality }` to the engine.
7. Engine captures, creates the peer connection (no STUN/TURN), sends the **offer** to main, which relays it → viewer.
8. Viewer answers → `answer { sdp }`; ICE candidates trickle both ways as `ice` messages.
9. From the moment a viewer is paired until it leaves, `AwakeGuard` (`awake-guard.ts`) holds a `KeepAwake` block (Electron `powerSaveBlocker`, `prevent-display-sleep`), so the idle timer cannot blank the display or sleep the host. It lets go when the viewer is gone, including on suspend, and takes the block again on the next pairing or resume. Media flows peer to peer over the LAN. The viewer sends `stats` every 2 s; the host window shows them.
10. On a drop, the viewer reconnects with backoff (1, 2, 4, 8, 10 s) and sends `resume { token }` instead of the PIN, keeping the last frame on screen. The viewer also watches the bytes its transport receives (`LinkWatch`, `link-watch.ts`): none for 8 s counts as a drop even if no close arrives (host asleep, cable pulled). It retries at once when the browser fires `online` or the tab becomes visible. When the host suspends it closes the viewer's socket without a `bye` (`PowerEvents`), so the viewer keeps its token and retries; on resume the host re-checks its addresses straight away.

## Messages

All messages are JSON text frames, typed in `packages/protocol/src/messages.ts` and validated in `parse.ts` (anything invalid is dropped; a bad viewer message closes its socket).

| Direction     | Type          | Fields                                                                  |
| ------------- | ------------- | ----------------------------------------------------------------------- |
| host → viewer | `hello`       | `protocol`, `hostName`, `nonce`, `appVersion`                           |
|               | `paired`      | `token`                                                                 |
|               | `pair-failed` | `reason`: wrong-pin, locked, bad-token; `attemptsLeft`; `retryAfterSec` |
|               | `busy`        | (another viewer is connected)                                           |
|               | `offer`       | `sdp`                                                                   |
|               | `ice`         | `candidate` or null                                                     |
|               | `quality`     | `preset`: 1080p, 720p, low                                              |
|               | `input-state` | `available` (the host can put the viewer's mouse on its screen)         |
|               | `bye`         | `reason`: host-stopped, kicked, new-pin, capture-failed                 |
| viewer → host | `pair`        | `proof`                                                                 |
|               | `resume`      | `token`                                                                 |
|               | `answer`      | `sdp`                                                                   |
|               | `ice`         | `candidate` or null                                                     |
|               | `set-quality` | `preset`                                                                |
|               | `stats`       | `fps`, `kbps`, `rttMs`, `width`, `height`, `codec`, `lossPct`           |
|               | `leave`       |                                                                         |

Mouse input never uses the WebSocket. The host's engine opens a WebRTC data channel named `input` next to the video, and the viewer sends one JSON message per event on it: `mouse-move` (`x`, `y`, absolute 0..65535 across the primary screen), `mouse-button` (`button`, `down`) `mouse-wheel` (`dx`, `dy` notches, positive `dy` scrolls up) and `key` (`code`, `down`). A key is the physical `KeyboardEvent.code`, turned into a Windows virtual-key code on the host by `keyCodeToVk` (`keys.ts`), so the host's layout decides the character. The viewer forwards the browser's key repeats as further down messages (Windows does not repeat injected keys), never sends Esc (it lets go of control), and lifts held keys when control ends. Combinations a browser on plain HTTP keeps for itself (Alt+Tab, Win, Alt+F4, Ctrl+W) are sent by the shortcut bar (`shortcut-bar.ts`) as ordinary `key` messages built by `comboMessages` (`shortcuts.ts`); opening the toolbar with Ctrl+Alt+Shift frees the locked pointer (`toggleLock`) so the bar can be clicked while control continues; the same chord locks it again. The engine checks each message with `parseInputMessage` and passes it to main as an `EngineEvent` (`input`). `input-bridge.ts` thins out floods of moves (250 per second, keys are never dropped), maps messages to `InputCommand`s for the `InputInjector`, and lets go of held buttons when the viewer leaves or the connection drops.

Inside the host, main and the engine talk with `EngineCommand` (`start`, `answer`, `ice`, `quality`, `stop`) and `EngineEvent` (`offer`, `ice`, `connection`, `input`, `stopped`, `error`); UI windows send `HostAction`s. These are in `packages/protocol/src/host-internal.ts` and never cross the network.

## Video

- Capture: primary display, up to 1920×1080 at up to 60 fps, `contentHint = "motion"` (ADR-016). The viewer also asks its receiver for the smallest playout buffer (`lowLatency` in `receiver.ts`), because on a LAN extra buffering only delays the pointer.
- Codec: H.264 preferred when both sides support it, otherwise VP8.
- Presets: 1080p (min 3, start 6, max 12 Mbps), 720p (min 1.5, start 3, max 6 Mbps) and Low (480p, 15 fps, min 0.3, start 0.6, max 1 Mbps, for Bluetooth and other very slow links). Each preset also sets the frame rate cap: 60 fps for 1080p and 720p, 15 for Low. The cap is applied with `scaleResolutionDownBy` and `maxBitrate`; min and start go into the answer SDP as `x-google-*-bitrate` hints (`withBitrateHints`) so motion bursts are not encoded at a low starting bitrate; `degradationPreference = maintain-resolution` keeps text sharp by dropping frames first.
- Auto: the viewer's "Auto" choice runs `autoStep` (`auto-quality.ts`) on the stats it already measures each second. It steps down one preset after about 6 s of loss of 3% or more or a round trip over 250 ms, and up after about 30 s of a quiet link, at most once per 15 s, and sends the existing `set-quality`. Frame rate is ignored because a still desktop sends few frames. The viewer remembers its choice (Auto or a preset) in browser storage and restores it after pairing.

## Extension points

- **Platform interfaces** (`apps/host/src/main/platform/`): `ScreenCapturer`, `KeepAwake` and `InputInjector`, injected into the controller from `main.ts`. Electron implementations sit beside them; `NullInputInjector` stands in when the helper exe is missing.
- **Capture** (`engine.ts`) and **input injection** (`HelperInputInjector`, backed by `pilotpane-input.exe`, a small C# `SendInput` helper built from `apps/host/helper/` by `scripts/build-helper.mjs` and driven over a stdin text protocol, see `apps/host/helper/PROTOCOL.md`) are the platform-specific parts. A macOS or Linux host replaces only those.
- **Transport**: every connection type (router, cable, hotspot, tethering, Bluetooth PAN) is just "an IPv4 LAN" to PilotPane. There is no transport-specific code.

## Repository layout

```
apps/host/src/main        Electron main process (Node, ESM)
apps/host/src/renderer    host, pin and engine windows (browser ESM)
apps/host/assets          icons
apps/viewer/src           viewer page (ES2020)
packages/protocol/src     messages, parsing, SHA-256, PIN proof, internal types
docs/                     you are here
scripts/                  build helpers (plain Node)
```
