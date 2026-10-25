# Spec 024: Packaging (portable build)

Status: Done | Package(s): host, tooling | Depends on: 010

## Goal

`pnpm package` produces a self-contained Windows folder and zip (`PilotPane-<version>-win-x64`) that runs on a machine with no Node, pnpm or source checkout. This is the base for the installer (025), updater (026) and release pipeline (027).

## Scope

- In: staging script, runtime layout that works unchanged from a staged folder, `.ico` icon, `pnpm package`, zip output, self-check of the staged layout, docs.
- Out: the installer (025), update check and apply (026), CI release workflow and website (027), code signing, asar, embedding the icon into the exe (needs a package such as rcedit; the installer shortcuts use the `.ico` instead), macOS and Linux.

## Screens

No screens.

## Protocol messages

None.

## Design (SOLID)

- `scripts/package.mjs`: plain Node, one job: stage and zip. Steps are small functions: `stageElectron`, `stageApp`, `stageWorkspacePackages`, `verifyStage`, `zipStage`. Reads the version from the root `package.json`.
- Layout of the staged folder:

  ```
  PilotPane-<ver>-win-x64/
    PilotPane.exe                  (electron.exe renamed, Electron runtime files beside it)
    resources/app/
      package.json                 (name pilotpane, productName PilotPane, version, type module, main)
      dist/                        (apps/host/dist: main, renderer, assets, helper; no *.test.js, no *.map)
      node_modules/@pilotpane/protocol/   (package.json + dist)
      node_modules/@pilotpane/viewer/     (package.json + dist)
  ```

  Staging real copies of the two workspace packages under `node_modules` means the existing `import.meta.resolve('@pilotpane/protocol')` and `'@pilotpane/viewer/package.json'` calls in `main.ts` resolve unchanged, so no runtime path code changes and dev behaviour is untouched.

- `scripts/make-ico.mjs`: wraps `icon-256.png` in an ICO container (ICO can hold PNG data), so no image package is needed. Output `apps/host/assets/icon.ico`, committed.
- No asar: the input helper exe must be spawnable and the LAN server reads files from disk.
- Nothing is injected; these are build scripts, not host modules.

## New dependencies

None. Zip uses the `tar -a -c -f` that ships with Windows 10/11. The Electron runtime is copied from `node_modules/electron/dist`.

## Tasks (each task = one logical commit)

1. `chore(host): generate icon.ico from the png` — `scripts/make-ico.mjs` and `apps/host/assets/icon.ico`.
2. `feat(tooling): stage a portable app folder` — `scripts/package.mjs` stage steps and the layout above, with the staged `package.json`.
3. `feat(tooling): verify the stage and zip it` — `verifyStage` (required files present, no `*.test.js`, helper exe present or a clear warning) and `zipStage`; add `package` script to the root `package.json` (`pnpm build && node scripts/package.mjs`); add `out` to `scripts/clean.mjs`.
4. `docs: document the portable build` — `docs/DEPLOYMENT.md` "Building a portable package", `docs/ROADMAP.md` Distribution section (024 to 027), `README.md` developer note.

## Done when

- [ ] `pnpm package` succeeds from a clean checkout after `pnpm install` and prints the folder and zip paths.
- [ ] The staged folder has the layout above and contains no `*.test.js` or source maps.
- [ ] Running `out/PilotPane-<ver>-win-x64/PilotPane.exe` on its own (no pnpm, repo folder not needed) shows the PIN screen and the tray icon.
- [ ] A viewer can open the printed address, pair with the PIN, and see the screen.
- [ ] Mouse and keyboard helper is found (no "input disabled" log line) when the helper was built.
- [ ] The app still starts with `pnpm start` exactly as before.
- [ ] The zip unpacks to a working copy in another folder.
- [ ] `pnpm format:check`, `pnpm build` and `pnpm test` pass.

## Manual test guide

- **Host (Git Bash):**
  1. Quit any running PilotPane (tray icon > Quit), so the input helper can be rebuilt.
  2. `pnpm package`. It prints `folder: out\PilotPane-0.1.0-win-x64` and `zip: out\PilotPane-0.1.0-win-x64.zip`.
  3. Copy the zip to a folder outside the repo (for example your Desktop), unzip it there, and double-click `PilotPane.exe`. Running from outside the repo shows it does not need the source.
  4. Allow the firewall prompt on Private networks.
- **Viewer (Windows 8 / Chrome 109 laptop):** open the address shown on the host PIN screen, type the PIN, and wait for the picture.
- **Expected results:**
  - The big PIN screen, the small PilotPane window and the tray icon appear. The window title and taskbar entry say PilotPane, with the PilotPane icon in the window.
  - The viewer pairs and shows the host screen.
  - The folder has no `.test.js` or `.map` files under `resources/app`, and `resources/app/dist/helper/pilotpane-input.exe` exists.
  - `pnpm start` still works as before.
- **Failure case:** delete `resources/app/dist/helper/pilotpane-input.exe` from the unzipped copy and start it. The app should still start and stream, with mouse and keyboard input off (not a crash). Then run `pnpm package` with Electron missing (for example in a clone installed with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`): it should stop with the message "Electron is not installed".
