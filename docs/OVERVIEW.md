# Project overview

## The problem

A Windows laptop (the **host**) has a hardware display fault: the picture jitters and text doubles, worse at high refresh rates and when warm. Until it's repaired, an old laptop (the **viewer**: Windows 8, Chrome 109, broken Wi-Fi antenna) should act as its screen, and later as its keyboard and mouse, over a local connection. No money, no cloud, and built by hand as a learning and portfolio project.

## What PilotPane is

- **Host app** (Windows 10/11, Electron): captures the screen, streams it with low latency over WebRTC, serves the viewer page, and (from v0.2) injects the viewer's mouse and keyboard input.
- **Viewer**: a web page served by the host. Open an address, type a PIN, see the screen. Nothing to install.
- **LAN only**: no accounts, no relays, no data leaving the local network.

## Who it's for

1. People with a laptop whose screen is broken or failing.
2. People with an old laptop or tablet who want to use it as a second screen or remote control.
3. Developers who want a small, readable example of screen streaming, WebRTC signaling and a hand-written WebSocket server.

## Principles

- **Works on old hardware.** Chrome 109 on Windows 8 is a first-class target, tested on real old hardware.
- **Usable without the host's screen.** Big PIN on start, tray menu, auto-reconnect, and later a "host screen off" mode.
- **Private by design.** LAN-only listeners, PIN proof instead of the PIN, one viewer at a time.
- **Small and readable.** Core features written in the repo, not pulled from packages (see CLAUDE.md).
- **Ship small versions.** Each version is useful on its own; see the [roadmap](ROADMAP.md).

## Out of scope

Internet or remote access, accounts, cloud file sync, recording.

## Platforms

| Part | v0.x | Later |
|---|---|---|
| Host | Windows 10/11 | macOS, Linux (capture and input sit behind interfaces) |
| Viewer | Any browser with WebRTC: Chrome 109+ (incl. Windows 7/8), Edge, Firefox, ChromeOS, macOS, Linux | Touch-friendly tablet and phone viewer |

## Brand

Name **PilotPane** (repo, package and CLI: `pilotpane`). Logo: a window pane with a cursor ("Pane + cursor"). Themes: Cockpit (default), Daylight, Midnight, Contrast. The design canvas holds every screen in every theme, the logo system and the journal layout; exported images go in `docs/design/` when needed.
