# Roadmap

Each version is useful on its own and ships when its spec's acceptance criteria pass on real hardware (including the Windows 8 / Chrome 109 viewer).

| Version | Theme | Specs (draft plan) |
|---|---|---|
| **v0.1** | See the screen | 001 Monorepo scaffold · 002 Typed protocol · 003 Own HTTP + WebSocket server · 004 PIN pairing · 005 Screen capture + WebRTC · 006 Viewer page for Chrome 109 · 007 Host window, tray, big PIN · 008 Status and stats overlay |
| v0.2 | Mouse + low bandwidth | 009 C# `SendInput` helper behind an `InputInjector` interface · 010 Mouse events, scaling, pointer lock · 011 Low-bandwidth preset (~1 Mbps, sharp text, adaptive fps) |
| v0.3 | Keyboard | 012 Keyboard events with modifiers · 013 Capture mode (fullscreen) + on-screen shortcut bar |
| v0.4 | Quality and reliability | 014 Presets: Coding, Smooth, Low bandwidth · 015 Auto-reconnect after sleep · 016 Keep host awake |
| v0.5 | Daily-use comfort | 017 Optional HTTPS (self-signed) · 018 Clipboard sync (with HTTP fallback) · 019 Start on login + ready sound · 020 Trusted devices |
| v0.6 | Host screen off | 021 Virtual display · 022 Safe panel restore + documented manual recovery |
| Later | If people use it | File drop, audio, multi-monitor, touch viewer, extended display, macOS/Linux hosts |

The v0.1 starter already includes 001 to 008 in a first form, plus keep-awake while streaming (from v0.4) because it is tiny and useful.
