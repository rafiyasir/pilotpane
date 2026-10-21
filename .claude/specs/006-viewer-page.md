# Spec 006: Viewer page for Chrome 109

Status: Done | Package(s): viewer | Depends on: 004, 005

Part of v0.1, "See the screen". Reconstructed from the original v0.1 spec after it was split; the acceptance criteria (AC-N) are the ones from that spec.

## Goal

The viewer page works on Chrome 109 over plain HTTP, handles every connection state and reconnects by itself.

## Scope

- In: ES2020 modules with no bundler, four themes, toolbar, fullscreen, reconnect with backoff and resume token, last frame kept on screen.
- Out: Input and clipboard.

## Screens

Viewer: PIN entry; Viewer: connecting; Viewer: streaming; Viewer: reconnecting; Viewer: error (all Confirmed).

## Protocol messages

None new.

## Design (SOLID)

- `socket.ts` (WebSocket and backoff), `receiver.ts` (peer connection), `main.ts` (screens and state).
- Secure-context APIs are checked with `window.isSecureContext`, with a fallback.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. Page shell, themes and screens
2. Socket with backoff and resume
3. Toolbar and fullscreen

## Done when

- [x] Chrome 109 on Windows 8 shows the PIN page with no console errors (AC-4).
- [x] After up to 30 s without network the viewer shows "Reconnecting" over the last frame and resumes without the PIN (AC-10).

## Manual test guide

- **Host (Git Bash):** `pnpm start`.
- **Viewer (Windows 8 / Chrome 109):** Open the address on the old laptop, pair, then unplug the cable for 10 s and plug it in again.
- **Failure case:** Unplug for longer than 30 s: the viewer stops retrying and offers a way back.
