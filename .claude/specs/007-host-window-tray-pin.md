# Spec 007: Host window, tray and big PIN

Status: Done | Package(s): host | Depends on: 004, 005

Part of v0.1, "See the screen". Reconstructed from the original v0.1 spec after it was split; the acceptance criteria (AC-N) are the ones from that spec.

## Goal

The host can be used without looking at its own screen: big PIN on start, a control window, a tray menu and clear problem screens.

## Scope

- In: Full-screen PIN window, host window, tray menu, pause and resume, new PIN, port-busy and no-network screens, keep-awake while streaming.
- Out: Start on login (v0.5), host screen off (v0.6).

## Screens

PIN screen; Host: ready; Host: viewer connected; Host: problem; Host: paused; Tray menu (all Confirmed).

## Protocol messages

Internal `HostAction` and `HostState` only.

## Design (SOLID)

- `controller.ts` (state and wiring), `windows.ts`, `tray.ts`, `settings.ts`, `app-protocol.ts`: one job each.
- Renderers talk to main only through `window.pilotpane`; main checks every sender.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. Windows and preload bridge
2. Tray menu
3. Controller state, pause and new PIN
4. Problem screens and keep-awake

## Done when

- [x] `pnpm start` shows a full-screen PIN and a LAN address within 5 s (AC-2).
- [x] "Pause sharing" disconnects the viewer and stops listening; "Resume sharing" brings back the PIN (AC-12).
- [x] If port 7420 is busy, "Use port 7421" works (AC-13).
- [x] With no network the host shows "No local network found" and recovers by itself (AC-14).
- [x] The host display does not sleep while a viewer watches (AC-15).
- [x] Closing the window keeps PilotPane in the tray; double-clicking the tray icon shows the PIN (AC-16).

## Manual test guide

- **Host (Git Bash):** `pnpm start`; try pause, resume, new PIN and quit from the tray.
- **Viewer (Windows 8 / Chrome 109):** Pair and watch for a few minutes; the host display stays on.
- **Failure case:** Port busy: run `node -e "require('http').createServer().listen(7420,'127.0.0.1')"` first, then `pnpm start`.
