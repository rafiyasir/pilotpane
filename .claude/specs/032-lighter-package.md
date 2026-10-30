# Spec 032: Lighter package (DROPPED)

Status: Dropped | Package(s): tooling | Depends on: 024, 025

Draft from real use: the installer is about 151 MB and the installed app about 350 MB. Most of that is Electron itself.

## Goal

A smaller download and install, without breaking the app on the Windows 8 viewer era hardware or on a clean Windows 10/11 host.

## Findings (from `out/PilotPane-0.1.0-win-x64/`, 369 MB)

| Item                       | Size   | Plan                                                      |
| -------------------------- | ------ | --------------------------------------------------------- |
| `PilotPane.exe` (Chromium) | 236 MB | cannot shrink without leaving Electron                    |
| `locales/` (55 languages)  | 49 MB  | keep `en-US` only; the UI is English                      |
| `dxcompiler.dll`           | 25 MB  | test on real hardware before touching                     |
| `LICENSES.chromium.html`   | 20 MB  | keep for license compliance (compresses well)             |
| `vk_swiftshader.dll`       | 5 MB   | test before touching; it is a software-rendering fallback |

Expected result: about 300 MB installed and about 120 MB installer.

## Scope

- In: drop unused locales in `scripts/package.mjs` (and set Electron's locale list if needed); a size budget check in the package script that fails above a limit; measure the result.
- Out: a native host to reach "really lite" (a new ADR if ever wanted, it reverses ADR-001); removing GPU or software-rendering libraries without testing on real hardware.

## Tasks (to be made commit-sized when the spec is built)

1. Package: copy `locales/en-US.pak` only; verify the app starts and the host window text is fine.
2. Package: print the staged size and fail above a budget kept in the script.
3. Try removing each of the DLLs above one at a time; keep the removal only if the app starts and captures on a clean host. Write the result in the journal.
4. Docs: update `docs/DEPLOYMENT.md` with the new sizes and rule.

## Done when (draft)

- [ ] The staged folder and installer are smaller by the amounts measured in task 1 and 3, numbers in the journal.
- [ ] `PilotPane.exe` starts, shows the host window and streams to the viewer from the installed copy.
- [ ] The package script fails when the size budget is exceeded.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` pass.

## Why dropped

Only the 55 Chromium language packs (about 49 MB, about 12 MB zipped) were safely removable, a saving of roughly 8% of the installer. The rest is Chromium itself (236 MB), which cannot shrink without leaving Electron (ADR-001), and the GPU fallback DLLs are not worth the risk. Not worth a release slot.

## Release

Was planned for 0.4.3 with spec 031.
