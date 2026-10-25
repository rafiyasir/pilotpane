# Changelog

All notable changes. Versions follow the [roadmap](docs/ROADMAP.md).

## [0.4.0] Quality and reliability

- Auto quality: the viewer steps between 1080p, 720p and Low as the link gets worse or better, and remembers your choice.
- Reconnect after host sleep: the viewer notices a silent link, keeps the last picture and comes back without a PIN when the host wakes.
- Keep the host awake: while a viewer is paired, the host does not blank the display or fall asleep. It lets go when the viewer leaves or the host suspends.
- Fixes for held keys, which now repeat, and for mouse wheel scrolling.

## [0.3.0] Keyboard

- Keyboard control: the viewer sends physical key codes and the host turns them into Windows virtual-key codes, so the host's layout decides the character.
- Capture mode and a shortcut bar for Alt+Tab, Win, Alt+F4 and Ctrl+W. The bar can be moved, resized and faded. Ctrl+Alt+Shift frees the pointer to use the toolbar.
- Known issues, fixed in 0.4.0: held keys do not repeat, and mouse wheel scrolling needs a fix.

## [0.2.0] Mouse, low bandwidth and shipping

- Mouse control over the encrypted WebRTC data channel, with pointer lock.
- A small C# helper that calls Win32 `SendInput`, built with the compiler that ships with Windows.
- A Low preset (480p, 15 fps) for very slow links such as Bluetooth.
- Host code split behind small interfaces for capture, keep-awake and input.
- Portable zip and a per-user Windows installer with no admin prompt.
- In-app updates: a signed manifest is checked only when you click, and the download is verified before it runs.
- Release pipeline: a tag builds the installer and zip on GitHub as a draft release, and `pnpm release:sign` signs the manifest locally and writes the download page.
- `pnpm scan`: a secret and personal-data scanner for tracked files, staged changes and git history.
- The repository was recreated with rewritten history so commits and tags carry only the GitHub noreply address. Commit hashes changed, and the `spec-NNN-done` tags point at the new commits.

## [0.1.0] See the screen

Source snapshot, no installer.

- Host app (Electron): primary screen capture, WebRTC streaming (H.264 preferred), 1080p and 720p presets.
- Own HTTP server and WebSocket (RFC 6455), listening only on private LAN addresses.
- PIN pairing with a one-time SHA-256 proof, lockout after 5 wrong tries, resume tokens, one viewer at a time.
- Host window, full-screen PIN on start, tray menu, pause and resume, new PIN, port-busy and no-network screens.
- Viewer page for Chrome 109+: PIN entry, connection states, auto-reconnect keeping the last frame, toolbar, stats overlay, four themes.
- Keeps the host display awake while a viewer is watching.
