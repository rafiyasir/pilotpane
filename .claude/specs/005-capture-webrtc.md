# Spec 005: Screen capture and WebRTC

Status: Done | Package(s): host, viewer | Depends on: 004

Part of v0.1, "See the screen". Reconstructed from the original v0.1 spec after it was split; the acceptance criteria (AC-N) are the ones from that spec.

## Goal

After pairing, the viewer shows the host screen over a peer-to-peer WebRTC stream.

## Scope

- In: Hidden engine window, primary screen capture, send-only peer connection, H.264 preferred, 1080p and 720p presets, viewer receiver.
- Out: Input, audio, multi-monitor.

## Screens

Viewer: streaming (Confirmed).

## Protocol messages

Uses `offer`, `answer`, `ice`, `quality`, `set-quality` and the internal `EngineCommand`/`EngineEvent`.

## Design (SOLID)

- `engine.ts` (capture and peer connection) sits behind the engine window; `receiver.ts` on the viewer.
- Main relays signalling only; it never touches media.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. Engine window with capture and peer connection
2. Signalling relay in the controller
3. Viewer receiver
4. Quality presets

## Done when

- [x] The right PIN shows the host screen on the viewer within 5 s (AC-6).
- [x] The stream is 1080p by default; 720p in the toolbar changes it within 3 s (AC-7).

## Manual test guide

- **Host (Git Bash):** `pnpm start`.
- **Viewer (Windows 8 / Chrome 109):** Pair with the PIN; the screen appears. Switch 1080p to 720p.
- **Failure case:** On a browser without WebRTC support the viewer shows a clear message instead of a blank page.
