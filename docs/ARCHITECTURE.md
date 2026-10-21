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
9. Media flows peer to peer over the LAN. The viewer sends `stats` every 2 s; the host window shows them.
10. On a drop, the viewer reconnects with backoff (1, 2, 4, 8, 10 s) and sends `resume { token }` instead of the PIN, keeping the last frame on screen.

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
|               | `quality`     | `preset`: 1080p, 720p                                                   |
|               | `bye`         | `reason`: host-stopped, kicked, new-pin, capture-failed                 |
| viewer → host | `pair`        | `proof`                                                                 |
|               | `resume`      | `token`                                                                 |
|               | `answer`      | `sdp`                                                                   |
|               | `ice`         | `candidate` or null                                                     |
|               | `set-quality` | `preset`                                                                |
|               | `stats`       | `fps`, `kbps`, `rttMs`, `width`, `height`, `codec`, `lossPct`           |
|               | `leave`       |                                                                         |

Inside the host, main and the engine talk with `EngineCommand` (`start`, `answer`, `ice`, `quality`, `stop`) and `EngineEvent` (`offer`, `ice`, `connection`, `stopped`, `error`); UI windows send `HostAction`s. These are in `packages/protocol/src/host-internal.ts` and never cross the network.

## Video

- Capture: primary display, up to 1920×1080 at 30 fps, `contentHint = "text"`.
- Codec: H.264 preferred when both sides support it, otherwise VP8.
- Presets: 1080p (min 3, start 6, max 12 Mbps) and 720p (min 1.5, start 3, max 6 Mbps). The cap is applied with `scaleResolutionDownBy` and `maxBitrate`; min and start go into the answer SDP as `x-google-*-bitrate` hints (`withBitrateHints`) so motion bursts are not encoded at a low starting bitrate; `degradationPreference = maintain-resolution` keeps text sharp by dropping frames first.

## Extension points

- **Capture** (`engine.ts`) and, from v0.2, **input injection** (an `InputInjector` interface backed by a small C# `SendInput` helper speaking a documented stdin protocol) are the platform-specific parts. A macOS or Linux host replaces only those.
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
