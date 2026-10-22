# Spec 025: Windows installer

Status: Done | Package(s): tooling | Depends on: 024

## Goal

`pnpm installer` produces one file, `PilotPane-Setup-<version>.exe`. Double-clicking it installs PilotPane for the current user (no admin prompt), adds a Start menu shortcut and an "Apps & features" entry, and starts the app. The same exe family removes it again.

## Scope

- In: a build step that gives `PilotPane.exe` its own name, publisher and icon (so Windows prompts say PilotPane, not Electron), a small C# setup program compiled with the `csc.exe` that ships with Windows (same approach as ADR-003), the zip from 024 embedded as its payload, per-user install, Start menu shortcut, uninstall registry entry, an uninstaller, `/S` silent mode, upgrade over an existing install, `pnpm installer`, docs.
- Out: code signing (SmartScreen will warn until then), auto-update (026), release pipeline and website (027), per-machine install, desktop shortcut, start on login (spec 020), custom installer UI or branding screens, MSI, macOS and Linux.

## Screens

No screens. The setup shows no window of its own: it installs silently and starts the app. Only native Windows message boxes appear, and only for errors or a request to close PilotPane. Anything fancier needs a design first.

## Protocol messages

None.

## Design (SOLID)

- `apps/installer/Setup.cs`: one C# file, modes chosen by arguments:
  - no args: install, then launch `PilotPane.exe`.
  - `/S`: install silently, do not launch.
  - `/uninstall`: remove shortcuts, registry entry and files (`/S` skips the confirmation).
- Install location: `%LOCALAPPDATA%\Programs\PilotPane`. Per-user, so no UAC prompt and no write access to Program Files is needed.
- Steps are small methods: `CloseRunningApp` (ask the user to quit PilotPane, or fail clearly if it is still running), `ExtractPayload` (unzip the embedded zip into a temp folder, then swap it into place so a failed install leaves the old version), `CreateShortcut` (Start menu `.lnk`, icon from `assets/icon.ico`, via `WScript.Shell` late-bound), `WriteUninstallEntry` (HKCU `Software\Microsoft\Windows\CurrentVersion\Uninstall\PilotPane`: DisplayName, DisplayVersion, Publisher, InstallLocation, DisplayIcon, UninstallString, NoModify, NoRepair, EstimatedSize), `CopyUninstaller` (copies the setup exe to `Uninstall.exe` in the install folder).
- Uninstall removes only the install folder, the shortcut and the registry key. It never touches user settings in `%APPDATA%` unless a later spec says so.
- `scripts/build-installer.mjs`: plain Node, one job: compile `Setup.cs` with `csc.exe`, embedding `out/PilotPane-<ver>-win-x64.zip` as a resource (`/resource:`) and the version as a compile-time define. Reuses the `csc.exe` lookup from `build-helper.mjs` by moving it to `scripts/lib/csc.mjs`. Runs `package.mjs` first if the zip is missing. Prints the installer path and size.
- Needs `System.IO.Compression.FileSystem` (part of .NET Framework 4.5+, present on Windows 8 and later). No NuGet, no installer toolkit.
- Nothing is injected; these are build scripts and a standalone program, not host modules.

## New dependencies

None. Inno Setup, NSIS and WiX were considered and rejected: each is a separate tool the maintainer and contributors must install, and none of them ships with Windows. Add an ADR-010 to `docs/DECISIONS.md` recording this choice.

## Tasks (each task = one logical commit)

1. `refactor(tooling): share the csc lookup` — move the compiler lookup out of `build-helper.mjs` into `scripts/lib/csc.mjs`; behaviour unchanged.
2. `feat(installer): add the setup program` — `apps/installer/Setup.cs` install, silent and uninstall modes with the steps above.
3. `feat(tooling): build the installer exe` — `scripts/build-installer.mjs`, `installer` script in the root `package.json`, `out` already cleaned; `apps/installer` excluded from tsc and Prettier as needed.
4. `fix(tooling): name the packaged exe PilotPane` — `scripts/rebrand/Rebrand.cs` (Win32 `UpdateResource` rewrites the version info and icon, compiled by `package.mjs` with csc.exe) and the `brandExe` step in `scripts/package.mjs`.
5. `docs: document the installer` — ADR-010, `docs/DEPLOYMENT.md` "Building the installer" and the SmartScreen note, `docs/ROADMAP.md` (025 In progress, then Done at PR time), `README.md` developer note.

## Done when

- [ ] `pnpm installer` succeeds after `pnpm package` inputs exist and prints `out\PilotPane-Setup-<ver>.exe`.
- [ ] The firewall prompt, Task Manager and the file's Properties > Details say PilotPane (not Electron or GitHub, Inc.), and the exe keeps the PilotPane icon.
- [ ] Running the exe installs to `%LOCALAPPDATA%\Programs\PilotPane` with no UAC prompt, then PilotPane starts and shows the PIN screen and tray icon.
- [ ] A "PilotPane" Start menu shortcut exists and starts the app with the PilotPane icon.
- [ ] PilotPane appears in Settings > Apps > Installed apps with its version and an Uninstall button.
- [ ] Uninstalling from there removes the folder, the shortcut and the registry entry.
- [ ] Running the installer again over an existing install upgrades it, and a failed upgrade leaves the old version working.
- [ ] If PilotPane is running, the installer asks once, then closes it and continues (never an endless prompt).
- [ ] `PilotPane-Setup.exe /S` installs with no window and without launching the app.
- [ ] A viewer can still pair and see the screen from the installed copy, and the input helper is found.
- [ ] `pnpm format:check`, `pnpm build` and `pnpm test` pass; `pnpm start` is unchanged.

## Manual test guide

- **Host (Git Bash):**
  1. Quit any running PilotPane (tray icon > Quit), including old test copies.
  2. `pnpm installer`. It prints `installer: out\PilotPane-Setup-0.1.0.exe (about 150 MB)`.
  3. Double-click `out\PilotPane-Setup-0.1.0.exe` in Explorer. SmartScreen may say "Windows protected your PC": More info > Run anyway. There is no admin prompt.
  4. Allow the firewall prompt on Private networks if it appears. It should say PilotPane, with publisher Rafi Uzzaman. (Windows asks again for a new path, and for a changed exe.)
  5. Press the Windows key, type "PilotPane", and check the shortcut and icon. Open Settings > Apps > Installed apps and find PilotPane 0.1.0.
  6. Quit PilotPane from the tray, then run the installer again (upgrade). It should finish and start the app.
  7. Quit PilotPane, then Settings > Apps > Installed apps > PilotPane > Uninstall, and confirm.
  8. Silent mode (set the variable first, or Git Bash rewrites `/S`): `MSYS_NO_PATHCONV=1 out/PilotPane-Setup-0.1.0.exe /S`. Nothing appears and the app does not start. Remove it again with `MSYS_NO_PATHCONV=1 "$LOCALAPPDATA/Programs/PilotPane/Uninstall.exe" /uninstall /S`.
- **Viewer (Windows 8 / Chrome 109 laptop):** while the installed copy runs, open the address on the host PIN screen, type the PIN, and wait for the picture. Move the mouse (the input helper must be found).
- **Expected results:**
  - After step 3 the big PIN screen and the tray icon appear within a few seconds, with no window from the installer.
  - `%LOCALAPPDATA%\Programs\PilotPane\PilotPane.exe` and `Uninstall.exe` (small, under 100 KB) exist; the app has the PilotPane icon.
  - The viewer pairs and shows the screen.
  - After uninstall, the folder `%LOCALAPPDATA%\Programs\PilotPane`, the Start menu shortcut and the Installed apps entry are gone.
- **Failure case:** start the installed PilotPane, then run the installer again without quitting it. One message box asks "Close it and continue?". OK closes PilotPane and the install continues; Cancel changes nothing and the box does not come back. The same applies to Uninstall while the app runs. With `/S` it exits with code 2 and leaves the app running.
