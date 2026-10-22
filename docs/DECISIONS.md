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
