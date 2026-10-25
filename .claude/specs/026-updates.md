# Spec 026: In-app updates

Status: Done | Package(s): protocol, host, tooling | Depends on: 024, 025

## Goal

The user clicks "Check for updates" (tray menu or host window). PilotPane fetches a signed manifest from GitHub Pages, tells them if a newer version exists, downloads the installer on request, verifies it, and restarts into the new version. Nothing is checked automatically.

## Scope

- In: signed manifest type and parser, Ed25519 signature check with Node `crypto`, version compare, download with size cap and SHA-256 check, silent install through the spec 025 installer (`/S`) and restart, update state in the controller, tray item, three host window cards, a release-time script that signs a manifest, ADR, security notes.
- Out: automatic or background checks, update channels, delta updates, rollback UI, code signing of the exe (SmartScreen), publishing the manifest from CI (spec 027), macOS and Linux.

## Screens

From the DESIGN.md inventory, all Confirmed: "Host: update available", "Host: updating", "Host: update problem", and the "Check for updates" tray item. "You are up to date" is the short `ok` line in the update-available card, with no buttons. No other UI.

## Protocol messages

No network messages (nothing new crosses the LAN). Two additions in `packages/protocol`:

- `UpdateManifest` in `update.ts`: `version` (semver `x.y.z`), `url` (https, or `http://127.0.0.1` for local tests), `sha256` (64 hex), `size` (bytes, max 300 MB), `notes` (array of up to 3 strings, each up to 120 chars), `signature` (base64 Ed25519 over the canonical payload). Parser `parseUpdateManifest(text)` returns a result or a reason, never throws, rejects text over 8 KB.
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

The real manifest is not published yet, so the test uses a local "update server" on `127.0.0.1`. The test key pair is in `private/update-key/` (ignored by git) and its public half is already in `config.ts`. All commands run from the repo root in Git Bash. The updater only installs in the installed app, so step 1 installs it first.

**1. Install the app and make a fake update**

```bash
pnpm installer                                   # writes out/PilotPane-Setup-0.1.0.exe
MSYS_NO_PATHCONV=1 ./out/PilotPane-Setup-0.1.0.exe /S   # installs silently (quit any running PilotPane first)
mkdir -p out/update-test
cp out/PilotPane-Setup-0.1.0.exe out/update-test/Setup.exe
node scripts/sign-manifest.mjs sign --key private/update-key/update-private.pem \
  --installer out/update-test/Setup.exe --version 0.2.0 \
  --url http://127.0.0.1:8099/Setup.exe \
  --note "Test note one" --note "Test note two" --out out/update-test/manifest.json
```

The "new" installer is the same 0.1.0 installer, claimed as 0.2.0 by the manifest. The update flow is identical; the app will still say v0.1.0 afterwards.

**2. Start the update server (second Git Bash window, logs every request)**

```bash
node -e "require('http').createServer((q,r)=>{console.log(new Date().toISOString(),q.url);require('fs').createReadStream('out/update-test'+q.url).on('error',()=>{r.statusCode=404;r.end()}).pipe(r)}).listen(8099,'127.0.0.1')"
```

**3. Start the installed app pointing at it**

```bash
PILOTPANE_UPDATE_URL=http://127.0.0.1:8099/manifest.json "$LOCALAPPDATA/Programs/PilotPane/PilotPane.exe"
```

**Happy path (host laptop)**

1. Leave the app alone for a minute. Expect: the server window prints nothing. No request is made without a click.
2. In the host window footer click **Check for updates**. Expect: a card "Checking for updates", then "Update available" with `v0.2.0`, "You have 0.1.0. What is new:", the two notes, and **Download** and **Later**. The server prints `/manifest.json`.
3. Click **Later**. Expect: the card disappears. Click **Check for updates** again, then **Download**. Expect: "Downloading 0.2.0" with a bar and "N of N MB", then "Checking the update", then "Update ready" with **Restart to install**. The server prints `/Setup.exe`.
4. Click **Restart to install**. Expect: PilotPane closes, and 5 to 20 seconds later it opens again (the installer runs silently in between). The PIN window shows again.
5. Right-click the tray icon. Expect: **Check for updates** sits right after **New PIN**. Click it. Expect: the host window comes forward and shows the card. The manifest says 0.2.0 and the app is 0.1.0 again, so it offers the update again.
6. Switch through all four themes with the card showing. Expect: readable text, visible dot and bar, and a visible focus ring on the buttons in every theme.

**Viewer (Windows 8 / Chrome 109 laptop)**

After step 4 above, open the address the host shows and enter the new PIN. Expect: pairing and the screen work as before. Updating does not change the viewer.

**Failure cases (each starts from "Check for updates" with the server running)**

- **Edited manifest.** Change `Test note one` to `Test note ONE` in `out/update-test/manifest.json`. Click **Check for updates**. Expect: "Could not update", "The update did not pass the safety check, so it was not installed. You are still on 0.1.0." with **Try again** and **Keep this version**. The server prints no `/Setup.exe`.
- **Wrong download.** Re-run the `sign` command from step 1, then run `echo x >> out/update-test/Setup.exe`. Check, then **Download**. Expect: "Could not update", "The downloaded file did not pass the safety check". The folder `%TEMP%\PilotPane-update` has no installer left.
- **No server.** Stop the update server (Ctrl+C) and click **Check for updates**. Expect: "Could not update" with the "could not reach the update page" text. **Keep this version** hides the card.
- **Already current.** Re-sign with `--version 0.1.0`. Expect: a green dot and "You are up to date", no buttons.
- **Run from source.** `pnpm start`, then check, download and click **Restart to install**. Expect: "Could not update", "The installer could not be started". The app keeps running.

Clean up: stop the server, then `rm -rf out/update-test`. To go back to a normal install, run `./out/PilotPane-Setup-0.1.0.exe`.
