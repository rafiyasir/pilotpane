# Decisions

Short architecture decision records. Newest last. Each says what we chose, what we didn't, and why.

## ADR-001: Electron for the host

- **Chose**: Electron (desktopCapturer + Chromium WebRTC).
- **Instead of**: a native capture + ffmpeg pipeline, or a Rust/Tauri app.
- **Why**: screen capture, hardware-friendly video encoding and WebRTC come built in, and the whole project stays in TypeScript. Cost: a larger download, acceptable for a desktop tool.

## ADR-002: No third-party packages for features

- **Chose**: write features ourselves; only the platform (Node, Electron, browser) at runtime, and official dev tools (TypeScript, `@types/node`).
- **Instead of**: `ws`, `express`, nut.js, robotjs, bundlers.
- **Why**: nothing "fishy" or paid in the supply chain, a codebase others can read end to end, and every piece becomes a lesson. nut.js in particular now requires a paid registry for prebuilt packages.

## ADR-003: Own C# helper for input injection (v0.2)

- **Chose**: a tiny `pilotpane-input.exe` compiled from our C# source with the .NET Framework compiler that ships with Windows, calling Win32 `SendInput`. The host talks to it over stdin with a small documented text protocol, behind an `InputInjector` interface.
- **Instead of**: nut.js (paid prebuilds), koffi or other FFI packages, a C++ Node addon (needs Visual Studio Build Tools and per-Electron rebuilds).
- **Why**: zero npm packages, nothing extra to install. Switching to a C++ helper later only means replacing the exe behind the same protocol.

## ADR-004: HTTP by default, optional HTTPS in v0.5

- **Chose**: serve the viewer over plain HTTP on the LAN, with fallbacks for secure-context-only APIs; add an optional self-signed HTTPS port in v0.5.
- **Instead of**: HTTPS only.
- **Why**: no certificate warnings on old browsers, nothing to install on the viewer. Video and (from v0.2) input are encrypted by WebRTC anyway. HTTPS later unlocks real clipboard sync and Keyboard Lock for those who want it.

## ADR-005: One viewer at a time

- **Chose**: a single active viewer; others get "busy".
- **Instead of**: multiple simultaneous viewers.
- **Why**: each viewer needs its own encode, which hurts slow links like Bluetooth, and several people controlling one mouse needs extra rules. The session code keeps the door open for more viewers later.

## ADR-006: pnpm workspaces, no Turborepo, MIT license

- **Chose**: pnpm 10 workspaces (install scripts blocked by default, only Electron allowlisted) and the MIT license.
- **Instead of**: npm/yarn, Turborepo; AGPL or GPL.
- **Why**: pnpm's script blocking enforces ADR-002 automatically, and `tsc -b` already orders the builds. MIT is the simplest license for a learning project that should be easy to reuse.

## ADR-007: The PIN never travels

- **Chose**: the host sends a random nonce; the viewer sends `SHA-256("pilotpane-pin:v1:" + nonce + ":" + pin)`, computed with our own SHA-256 because `crypto.subtle` is unavailable on plain-HTTP pages.
- **Instead of**: sending the PIN, or adding a crypto library.
- **Why**: anyone sniffing the LAN sees only a one-time hash. Five wrong tries pause pairing for 60 s.

## ADR-008: LAN addresses via mDNS hiding turned off

- **Chose**: start Electron with `WebRtcHideLocalIpsWithMdns` disabled, and use no STUN/TURN.
- **Instead of**: Chromium's default `.local` mDNS candidates.
- **Why**: on a direct cable or Bluetooth link there may be no working mDNS, and the viewer could never resolve the host. Real private addresses are fine here: they never leave the LAN.

## ADR-009: Dev workflow tooling

- **Chose**: Prettier as the only new dev dependency (`pnpm format`, `pnpm format:check`); a commit-msg hook of our own in `.githooks/` (plain Node, enabled with `pnpm setup-hooks`); small Claude Code hooks and commands in `.claude/`; GitHub Actions CI on `windows-latest` (install with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, build, test, format check).
- **Instead of**: husky, commitlint, lint-staged, Turborepo, ESLint plugins.
- **Why**: Prettier is a widely used open-source dev tool with no install scripts, and it ends style arguments. Everything else is a few lines of Node, which keeps ADR-002 intact: no runtime dependencies are added, and no tool needs an account. The hooks keep the history clean (Conventional Commits, no AI attribution) and stop risky commands (pushes to `main` or `dev`, `git add .`, anything touching `private/`). CI runs the same checks as `pnpm test` on the platform we ship for.

## ADR-010: Own C# installer, per-user

- **Chose**: a small `Setup.cs` compiled with the Windows `csc.exe`, with the portable zip embedded. It installs per user into `%LOCALAPPDATA%\Programs\PilotPane`, adds a Start menu shortcut and a registry uninstall entry, and ships a small uninstaller built from the same source.
- **Instead of**: Inno Setup, NSIS, WiX/MSI, electron-builder.
- **Why**: every one of those is a separate tool to install (or a package with install scripts), and none ships with Windows. The C# compiler already builds the input helper (ADR-003), so there is nothing new to trust. Per-user means no UAC prompt and fits a tool that runs in the user's session. Cost: no installer UI, no code signing yet, and setup is C# 5 (the compiler that ships with Windows).

## ADR-011: Signed manifest on GitHub Pages, checked only on click

- **Chose**: "Check for updates" fetches `manifest.json` from the project's GitHub Pages site. The manifest holds the version, installer URL, SHA-256, size and notes, and is signed with Ed25519. The host has the public key built in and checks the signature with Node `crypto` before it trusts anything in the manifest, then checks the downloaded installer against the signed SHA-256 and size. The check only happens when the user clicks; there is no background check and no timer.
- **Instead of**: trusting HTTPS alone, electron-updater or Squirrel, a GitHub API call, automatic checks at startup.
- **Why**: HTTPS only proves the server, and a hosting account or a compromised release asset would then be enough to push code to every laptop. A signature made with a key that stays off the hosting site means a stolen Pages account cannot ship an update. Both pieces come from Node, so there are no new packages (ADR-002). Manual-only keeps the promise that PilotPane makes no internet requests unless the user asks. The manifest URL can be overridden with `PILOTPANE_UPDATE_URL` for testing; the signature is still required, so this does not weaken the check. The `url` field in a manifest must be https, except `http://127.0.0.1` for local tests. Cost: the maintainer must guard the private key, and rotating it needs a new release signed by the old key.

## ADR-012: CI builds the release, the maintainer signs it

- **Chose**: a tag-triggered GitHub Actions workflow builds the installer and zip and makes a **draft** release with a `SHA256SUMS` file. The maintainer then runs `pnpm release:sign` locally: it downloads the files, checks them against `SHA256SUMS`, signs the update manifest with a key file that never leaves their machine, and renders the download page. Both files are committed to `main` and the release is published by hand. The page is written at release time and its only live request is the GitHub API call for the download count.
- **Instead of**: storing the signing key as a GitHub secret so CI can sign, or reading the version and hash from the GitHub API on every page view.
- **Why**: ADR-011 says a stolen hosting account must not be enough to ship code to every laptop. A signing key stored in the same GitHub account would undo that. Building in CI still gives a clean, repeatable build on a fresh machine, and the signed hash locks the manifest to exactly that file. Writing the version, size and hash into the page at release time means the page works without scripts and makes no request except the optional count. Cost: one manual command and one PR per release, and either the GitHub CLI is logged in on the maintainer's machine or the three files are downloaded by hand. A compromised workflow could still produce a bad build that the maintainer signs, so workflow changes get reviewed like code. The count comes from GitHub's own download statistics: it counts download requests (including in-app updates), not installs, and the app itself collects nothing.

## ADR-013: Mouse input on one ordered data channel, absolute positions

- **Chose**: the host's engine opens one ordered, reliable WebRTC data channel (`input`) beside the video. The viewer sends absolute pointer positions (0..65535 across the picture, one per animation frame at most), button changes and wheel notches. The host drops moves above 250 per second but never buttons or wheel. When control ends, the host releases held buttons.
- **Instead of**: sending input over the WebSocket, a separate unreliable channel for moves, or relative movement deltas.
- **Why**: the data channel is encrypted and only the paired viewer has it, so input never touches the plain-HTTP WebSocket (ADR-004). One reliable ordered channel keeps clicks and moves in order and is simplest; on a LAN the cost of retransmits is small, and coalescing moves to one per frame stops a queue building up. Absolute positions mean a lost or dropped move never leaves the pointer in the wrong place, and they work the same with and without pointer lock. Cost: on a very slow link (Bluetooth) a backed-up channel adds delay; the viewer skips moves while the channel buffer is full.

## ADR-014: A third quality preset for very slow links

- **Chose**: add a `low` preset (480p, 15 fps, 0.3 / 0.6 / 1 Mbps min / start / max) next to 1080p and 720p, with a frame rate cap per preset. `PROTOCOL_VERSION` goes to 2 because `quality` and `set-quality` now carry a value an old peer would drop.
- **Instead of**: automatic quality adaptation, or lowering the 720p floor.
- **Why**: Bluetooth PAN gives roughly 1 to 2 Mbps, and the 720p floor of 1.5 Mbps stalls there. A fixed preset is small, testable and needs no new messages. The viewer is served by the host, so both sides always match. Automatic adaptation from the `stats` the viewer already sends is a later idea, and would also suit any future internet use. Cost: the user picks Low by hand.

## ADR-015: Keys travel as physical codes, mapped on the host

- **Chose**: the viewer sends `key { code, down }` with the W3C `KeyboardEvent.code` over the existing `input` data channel. A shared table in `packages/protocol` (`keys.ts`) turns the code into a Windows virtual-key code, and the helper types it with `SendInput`. Unknown codes are rejected by the parser. Held keys are tracked on both sides and lifted when control ends. Esc is never sent, because it lets go of control.
- **Instead of**: sending typed characters, sending virtual-key codes from the viewer, or sending keys over the WebSocket.
- **Why**: a physical code is the same on any viewer layout, and the host's own layout then makes the right character, so shortcuts such as Ctrl+C work and nothing depends on the viewer's language. One table in the shared package is tested once and used by both sides. Cost: no input-method (IME) or dead-key composition from the viewer, and browser-reserved shortcuts (Alt+Tab, Win, Ctrl+W) are not reachable until the capture mode and shortcut bar of spec 014.

## ADR-016: Favour motion over text, allow 60 fps, smallest playout buffer

- **Chose**: set the capture track's `contentHint` to `motion` instead of `text`, raise the frame rate cap of the 1080p and 720p presets and of the capture constraint from 30 to 60 fps (Low stays at 15), and have the viewer set `playoutDelayHint` and `jitterBufferTarget` to 0 on its video receiver. `degradationPreference` stays `maintain-resolution`.
- **Instead of**: keeping `text` and 30 fps, or drawing the cursor on the viewer (a possible later step).
- **Why**: with `text`, Chrome treats the stream like slides and sends few frames. A paired viewer measured 18 fps and 0.4 Mbps at 1080p on a link with a 10 ms round trip and almost no loss, so the network was not the cause and the frame rate was a likely one. The pointer you see is part of the video, so every frame gap shows up as pointer lag. A 30 fps cap alone adds up to 33 ms between steps. Keeping `maintain-resolution` is meant to keep text sharp under load. Cost: more encoder work and heat on the host, so a long session may run hotter, and a zero playout buffer would stutter on a slow or jittery link, so it should be relaxed before any use beyond a LAN. The `degradationPreference` and bitrate hints are unchanged. The effect has been checked only by feel on two laptops, not measured end to end.

## ADR-017: Pause says `paused`, and the viewer waits

- **Chose**: a pause sends `bye` with the new reason `paused` (instead of `host-stopped`), and `PROTOCOL_VERSION` goes to 3. The viewer keeps its resume token and last frame, shows "Sharing is paused on the host. Waiting for it to resume.", and uses the normal retry backoff until the host answers. The host also shows no PIN window while paused (one `canShowPin()` check) and opens it again on Resume when no viewer is connected.
- **Instead of**: reusing `host-stopped` and having the viewer guess, or sending the drop with no `bye` as for sleep.
- **Why**: `host-stopped` also means the app was closed, where the viewer should stop and say so. A pause is temporary, so the viewer should come back by itself when sharing resumes. A separate reason lets each case show the right text. An old viewer page would drop the unknown reason, so the version is bumped; the host serves the viewer, so the two always match. Cost: one more reason to handle on both sides.
