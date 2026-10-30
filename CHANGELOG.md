# Changelog

All notable changes. Versions follow the [roadmap](docs/ROADMAP.md).

## [0.4.3] Sharper scrolling and a Quit button

- Scrolling stays sharp. The host now offers VP8 first and keeps text sharp in motion. If the host's processor gets busy, it lowers the frame rate and then the size by itself, and raises them again when it calms down.
- The viewer picks the best video codec for its own machine, so an older laptop is not stuck with a codec it decodes slowly. If its browser cannot say, it uses H.264.
- Pause is clear on both sides. The viewer shows that sharing is paused, keeps the last picture and comes back by itself when you resume. The big PIN screen stays away while paused. This changes the protocol version from 2 to 3, and the host serves the viewer, so both always match.
- Closing the host window now explains itself the first time: a short card says PilotPane is still running and where to find its icon. A Quit PilotPane button in the host window ends the app, and asks first if a viewer is connected.

## [0.4.2] Pointer feel

- The pointer follows the touchpad more closely. The host now sends up to 60 frames per second at 1080p and 720p (it was 30, and often fewer), and asks Chrome for motion instead of slide-style sharpness. Text stays sharp because the picture keeps its size when the link is busy. The viewer also asks its browser for the smallest video buffer. Low stays at 15 frames per second.
- The cost is more work and heat on the host, so a long session may run warmer. If the pointer slows down over a long session, tell us what the host log says.
- The download page has round theme swatches like the app, and reads better on a phone.
- Documentation: the release process and the first releases are written down.

## [0.4.1] Update check

- No behavior changes. This release checks that "Check for updates" now installs a new version from 0.4.0.

## [0.4.0] Quality and reliability

- Auto quality: the viewer steps between 1080p, 720p and Low as the link gets worse or better, and remembers your choice.
- Reconnect after host sleep: the viewer notices a silent link, keeps the last picture and comes back without a PIN when the host wakes.
- Keep the host awake: while a viewer is paired, the host does not blank the display or fall asleep. It lets go when the viewer leaves or the host suspends.
- Fixes for held keys, which now repeat, and for mouse wheel scrolling.
- Fix: in-app updates now install. The update script used to run inside the install folder, which stopped the installer from replacing it. If you are on 0.2.0 or 0.3.0, run the new installer once by hand; updates work from 0.4.0 on.

## [0.3.0] Keyboard

- Keyboard control: the viewer sends physical key codes and the host turns them into Windows virtual-key codes, so the host's layout decides the character.
- Capture mode and a shortcut bar for Alt+Tab, Win, Alt+F4 and Ctrl+W. The bar can be moved, resized and faded. Ctrl+Alt+Shift frees the pointer to use the toolbar.
- Known issues, fixed in 0.4.0: held keys do not repeat, mouse wheel scrolling needs a fix, and "Check for updates" cannot install a new version (run the installer by hand).

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

View only: no mouse or keyboard yet. Ships as an installer and a portable zip, with no in-app updates. To move to a newer version, run its installer over this one.

- Host app (Electron): primary screen capture, WebRTC streaming (H.264 preferred), 1080p and 720p presets.
- Own HTTP server and WebSocket (RFC 6455), listening only on private LAN addresses.
- PIN pairing with a one-time SHA-256 proof, lockout after 5 wrong tries, resume tokens, one viewer at a time.
- Host window, full-screen PIN on start, tray menu, pause and resume, new PIN, port-busy and no-network screens.
- Viewer page for Chrome 109+: PIN entry, connection states, auto-reconnect keeping the last frame, toolbar, stats overlay, four themes.
- Keeps the host display awake while a viewer is watching.
