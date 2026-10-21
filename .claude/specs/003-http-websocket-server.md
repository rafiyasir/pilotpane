# Spec 003: Own HTTP and WebSocket server

Status: Done | Package(s): host | Depends on: 001, 002

Part of v0.1, "See the screen". Reconstructed from the original v0.1 spec after it was split; the acceptance criteria (AC-N) are the ones from that spec.

## Goal

The host serves the viewer page and a WebSocket on private LAN addresses only.

## Scope

- In: LAN address discovery refreshed every 3 s, one `http.Server` per address, RFC 6455 WebSocket, `Host` and `Origin` checks, security headers.
- Out: Pairing and streaming.

## Screens

No screens.

## Protocol messages

None (frames carry the messages from spec 002).

## Design (SOLID)

- `net/lan.ts` (addresses), `net/http-server.ts` (HTTP and upgrade), `net/ws.ts` (framing): no Electron imports.
- The server receives the directories to serve and a connection handler.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. LAN address listing and classification
2. WebSocket framing
3. HTTP server with Host and Origin checks
4. Tests for each

## Done when

- [x] The host listens only on private LAN addresses and 127.0.0.1, never `0.0.0.0` (AC-3).
- [x] Opening the address in Chrome 109 loads the page with no console errors (AC-4).
- [x] A wrong `Host` or `Origin` is rejected.

## Manual test guide

- **Host (Git Bash):** `pnpm start`, then `netstat -ano | findstr 7420` in cmd.
- **Viewer (Windows 8 / Chrome 109):** Open `http://<address>:7420/`; the PIN page loads.
- **Failure case:** No `0.0.0.0:7420` line appears; a request with a foreign Host header gets an error.
