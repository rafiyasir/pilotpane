# Changelog

All notable changes. Versions follow the [roadmap](docs/ROADMAP.md).

## [Unreleased] v0.1.0: See the screen

- Host app (Electron): primary screen capture, WebRTC streaming (H.264 preferred), 1080p and 720p presets.
- Own HTTP server and WebSocket (RFC 6455), listening only on private LAN addresses.
- PIN pairing with a one-time SHA-256 proof, lockout after 5 wrong tries, resume tokens, one viewer at a time.
- Host window, full-screen PIN on start, tray menu, pause/resume, new PIN, port-busy and no-network screens.
- Viewer page for Chrome 109+: PIN entry, connection states, auto-reconnect keeping the last frame, toolbar, stats overlay, four themes.
- Keeps the host display awake while a viewer is watching.
- `pnpm scan`: our own secret and personal-data scanner for tracked files, staged changes and git history.
- Release pipeline: a tag builds the installer and zip on GitHub as a draft release, and `pnpm release:sign` signs the update manifest locally and writes the download page, with a live download count.
