# Spec 008: Status and stats overlay

Status: Done | Package(s): host, viewer | Depends on: 005, 006, 007

Part of v0.1, "See the screen". Reconstructed from the original v0.1 spec after it was split; the acceptance criteria (AC-N) are the ones from that spec.

## Goal

Both sides can see how the stream is doing: latency, fps, bitrate, size, codec and loss.

## Scope

- In: Viewer reads WebRTC statistics every second, shows an overlay, sends `stats` every 2 s; the host validates and shows them.
- Out: Graphs and history.

## Screens

Viewer: stats overlay; Host: viewer connected (both Confirmed).

## Protocol messages

Uses the viewer `stats` message (`fps`, `kbps`, `rttMs`, `width`, `height`, `codec`, `lossPct`).

## Design (SOLID)

- `receiver.stats()` turns counters into rates; `session.ts` validates and forwards; the host window only displays.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. Stats reading in the receiver
2. Overlay and toggle
3. Host-side validation and display

## Done when

- [x] The overlay toggles and shows latency, fps, bitrate, size, codec and loss; the host window shows viewer, duration and stats (AC-8).
- [x] Switching to 720p changes the size in the overlay within 3 s (AC-7).

## Manual test guide

- **Host (Git Bash):** `pnpm start` and pair.
- **Viewer (Windows 8 / Chrome 109):** Click Stats in the viewer toolbar; compare with the host window.
- **Failure case:** Invalid stats values are ignored by the host (covered by the parser tests).
