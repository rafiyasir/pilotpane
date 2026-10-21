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

`scripts/package.mjs` copies the Electron runtime, renames `electron.exe` to `PilotPane.exe`, and puts the compiled app in `resources/app/`. The two workspace packages (`@pilotpane/protocol`, `@pilotpane/viewer`) are copied as real packages under `resources/app/node_modules/@pilotpane/`, so the host finds them the same way as in development. Tests, source maps and type files are left out. There is no asar, because the input helper exe must be spawnable.

Run `PilotPane.exe` in the folder, or unzip the zip anywhere. Windows asks for firewall access the first time (see [connections](CONNECTIONS.md#firewall)). The folder is not an installer; the installer and updates come in later specs.

`pnpm package` only runs on Windows and needs `pnpm install` to have downloaded Electron. `apps/host/assets/icon.ico` is generated from `icon-256.png` with `node scripts/make-ico.mjs` and committed.

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
