# Spec 026: In-app updates

Status: In progress | Package(s): protocol, host, tooling | Depends on: 024, 025

## Goal

The user clicks "Check for updates" (tray menu or host window). PilotPane fetches a signed manifest from GitHub Pages, tells them if a newer version exists, downloads the installer on request, verifies it, and restarts into the new version. Nothing is checked automatically.

## Scope

- In: signed manifest type and parser, Ed25519 signature check with Node `crypto`, version compare, download with size cap and SHA-256 check, silent install through the spec 025 installer (`/S`) and restart, update state in the controller, tray item, three host window cards, a release-time script that signs a manifest, ADR, security notes.
- Out: automatic or background checks, update channels, delta updates, rollback UI, code signing of the exe (SmartScreen), publishing the manifest from CI (spec 027), macOS and Linux.

## Screens

From the DESIGN.md inventory, all Confirmed: "Host: update available", "Host: updating", "Host: update problem", and the "Check for updates" tray item. "You are up to date" is the short `ok` line in the update-available card, with no buttons. No other UI.

## Protocol messages

No network messages (nothing new crosses the LAN). Two additions in `packages/protocol`:

- `UpdateManifest` in `update.ts`: `version` (semver `x.y.z`), `url` (https only), `sha256` (64 hex), `size` (bytes, max 300 MB), `notes` (array of up to 3 strings, each up to 120 chars), `signature` (base64 Ed25519 over the canonical payload). Parser `parseUpdateManifest(text)` returns a result or a reason, never throws, rejects text over 8 KB.
- `canonicalPayload(manifest)`: the exact bytes that are signed (fixed field order, newline separated), so signer and verifier cannot disagree.
- `HostAction` gains `check-for-updates`, `download-update`, `install-update`, `dismiss-update`. `HostState` gains `update` (`idle`, `checking`, `up-to-date`, `available`, `downloading`, `ready`, `failed`, with version, notes, progress, reason). These are host-internal, so the `protocol` number does not change.

## Design (SOLID)

- `apps/host/src/main/updater/verify.ts`: `verifyManifest(manifest, publicKey)` and `compareVersions`. Pure, uses `node:crypto`. No Electron.
- `updater/updater.ts`: `Updater` class holding the update state machine. One job: move through check, download, verify, ready. Injected: `fetchText(url)`, `downloadFile(url, dest, onProgress)`, `now`, the public key, the current version. Emits state changes.
- `updater/apply.ts`: starts the downloaded `Setup.exe /S`, then asks the controller to quit. Injected spawner, so tests do not run an installer.
- `controller.ts` only forwards the four actions to `Updater` and publishes its state. `tray.ts` adds the menu item. The host window renders the three cards from `HostState.update`.
- Manifest URL and public key are constants in `updater/config.ts`. The Electron `net` fetch is wired in `main.ts`, so `updater/` stays testable in plain Node.
- `scripts/sign-manifest.mjs`: plain Node. Takes the installer path, version and notes, computes size and SHA-256, signs with a private key file given on the command line (never in the repo), writes `manifest.json`.

## New dependencies

None. Ed25519, SHA-256 and HTTPS all come from Node and Electron. Add ADR-011 to `docs/DECISIONS.md`: why a signed manifest on GitHub Pages, why Ed25519 with a baked-in public key, why manual check only.

## Tasks (each task = one logical commit)

1. protocol: `UpdateManifest`, `canonicalPayload`, `parseUpdateManifest`, with tests (valid, bad version, http url, oversize, bad hex, missing field).
2. host: `updater/verify.ts` with tests using a throwaway test key (good signature, tampered field, wrong key, version compare).
3. host: `updater/updater.ts` state machine with tests using fake fetch and download (up to date, newer, network error, bad signature, hash mismatch, size over cap).
4. host: `updater/apply.ts` and controller wiring for the four new actions, with a test for the quit-after-spawn order.
5. host: tray item "Check for updates" and `HostState.update` published to the host window.
6. host: the three cards in the host window, from the confirmed designs, in all four themes.
7. tooling: `scripts/sign-manifest.mjs` and a short `docs/DEPLOYMENT.md` section on publishing the manifest to Pages.
8. docs: ADR-011, security notes line (first outbound request, only after a click), roadmap, manual test guide.

## Done when

- [ ] `parseUpdateManifest` accepts a valid manifest and rejects every bad case with a reason, without throwing.
- [ ] A manifest with any field changed after signing fails verification and nothing is downloaded.
- [ ] A download whose SHA-256 or size differs from the manifest is deleted and shows "Could not update".
- [ ] Same or older version shows "up to date" and offers no download.
- [ ] No network request is made unless the user clicks "Check for updates" (or Download after that).
- [ ] The tray item and the three cards match DESIGN.md in all four themes.
- [ ] After "Restart to install", the installed app reports the new version.
- [ ] A failed or cancelled update leaves the current version running and working.
- [ ] No private key or personal data is in the repo; `pnpm format:check`, `pnpm build` and `pnpm test` pass.

## Manual test guide

Filled in by `/build`.

- **Host (Git Bash):** exact commands.
- **Viewer (Windows 8 / Chrome 109 laptop):** pairing and streaming still work after an update.
- **Expected results** for each step.
- **Failure cases:** a tampered manifest, a wrong hash, and no internet.
