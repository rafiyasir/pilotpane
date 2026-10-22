# Deployment

PilotPane has no server to deploy. The host runs on the user's own Windows laptop and the viewer is served by the host over the LAN. This file covers running from source, branches, CI, releases and the journal site.

## Running from source

Needs Node 22.12 or newer and pnpm 10 (via corepack).

```bash
pnpm install
pnpm build      # tsc -b, then copy static files
pnpm test       # build, then node --test on compiled tests
pnpm start      # build and launch the host
```

Works in Git Bash and PowerShell. No Docker, no accounts, no environment variables.

## Portable package

```bash
pnpm package    # builds, then writes out/PilotPane-<version>-win-x64/ and the same name .zip
```

`scripts/package.mjs` copies the Electron runtime, renames `electron.exe` to `PilotPane.exe`, and puts the compiled app in `resources/app/`. The two workspace packages (`@pilotpane/protocol`, `@pilotpane/viewer`) are copied as real packages under `resources/app/node_modules/@pilotpane/`, so the host finds them the same way as in development. `scripts/rebrand/Rebrand.cs` (compiled on the fly with the Windows `csc.exe`) rewrites the exe's version info and icon so Windows prompts such as the firewall one say PilotPane instead of Electron. Tests, source maps and type files are left out. There is no asar, because the input helper exe must be spawnable.

Run `PilotPane.exe` in the folder, or unzip the zip anywhere. Windows asks for firewall access the first time (see [connections](CONNECTIONS.md#firewall)). The folder is not an installer; the installer and updates come in later specs.

`pnpm package` only runs on Windows and needs `pnpm install` to have downloaded Electron. `apps/host/assets/icon.ico` is generated from `icon-256.png` with `node scripts/make-ico.mjs` and committed.

## Installer

```bash
pnpm installer  # builds, packages, then writes out/PilotPane-Setup-<version>.exe
```

`apps/installer/Setup.cs` is a small C# program compiled by `scripts/build-installer.mjs` with the `csc.exe` that ships with Windows (ADR-010). The portable zip from the section above is embedded in it, and so is a small uninstaller built from the same source.

- Installs for the current user only, into `%LOCALAPPDATA%\Programs\PilotPane`. No admin prompt.
- Adds a Start menu shortcut and an entry in Settings > Apps > Installed apps.
- Running the installer again upgrades in place. The new version is unpacked beside the old one and swapped in, so a failed upgrade keeps the old version.
- `PilotPane-Setup-<version>.exe /S` installs silently and does not start the app. Errors in silent mode go to `%TEMP%\PilotPane-setup.log`. In Git Bash set `MSYS_NO_PATHCONV=1` first, or it rewrites `/S`.
- If PilotPane is running, the installer asks once, then closes it and continues (silent mode never closes it and exits with code 2).
- Uninstall removes the folder, the shortcut and the registry entry. Settings in `%APPDATA%` are kept.

The installer is not code signed, so Windows SmartScreen shows "Windows protected your PC" on first run: choose **More info**, then **Run anyway**. Signing is out of scope for now.

## Publishing an update

In-app updates read a signed `manifest.json` from GitHub Pages (ADR-011). For a release, after `pnpm installer`:

```bash
# once: make a key pair. Keep the private key out of the repo (private/ is ignored).
node scripts/sign-manifest.mjs keygen private/update-key
# paste the printed public key into apps/host/src/main/updater/config.ts

node scripts/sign-manifest.mjs sign --key private/update-key/update-private.pem \
  --installer out/PilotPane-Setup-0.2.0.exe --version 0.2.0 \
  --url https://github.com/rafiyasir/pilotpane/releases/download/v0.2.0/PilotPane-Setup-0.2.0.exe \
  --note "What changed" --out docs/update/manifest.json
```

Commit `docs/update/manifest.json` to `main` with the release; Pages then serves it at `https://rafiyasir.github.io/pilotpane/update/manifest.json`. The installer itself is a release asset. Up to three notes of 120 characters each. Spec 027 automates these steps.

To try an update locally, serve a folder with a manifest and installer on `http://127.0.0.1` and start the app with `PILOTPANE_UPDATE_URL` pointing at the manifest (see the spec 026 test guide).

## Branches

| Branch | Purpose       | How it gets there                          |
| ------ | ------------- | ------------------------------------------ |
| `main` | releases only | merge commit from `dev` at a release       |
| `dev`  | integration   | spec, fix and docs PRs, "Rebase and merge" |

## CI

There is no CI workflow yet. Until one exists, `pnpm test` on Windows is the gate and the PR checklist says so. When a workflow is added, it should run `pnpm install --frozen-lockfile` and `pnpm test` on `windows-latest` for every PR into `dev` and `main`, and this section should be updated.

## Releasing vX.Y.Z

1. All specs for the version are Done in `ROADMAP.md` and their manual test steps passed on real hardware (including the Windows 8 / Chrome 109 viewer).
2. Bump `version` in the root `package.json` and the workspace packages.
3. Update `CHANGELOG.md`.
4. Open a PR `dev` -> `main` and merge it with "Create a merge commit".
5. Tag `main` as `vX.Y.Z` and push the tag.
6. Merge `main` back into `dev` if the release commit changed anything there.

## Journal site (GitHub Pages)

The learning journal is plain static files in `docs/journal/`, so it needs no build.

1. In the repository settings, open Pages and choose "Deploy from a branch".
2. Set the branch to `main` and the folder to `/docs`.
3. After the next release merge, the journal is at `https://rafiyasir.github.io/pilotpane/journal/`.

Until then, open `docs/journal/index.html` straight from disk (`file://`). Pages always shows what is on `main`, so new entries appear at the next release.
