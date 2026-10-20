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

## Branches
| Branch | Purpose | How it gets there |
| --- | --- | --- |
| `main` | releases only | merge commit from `dev` at a release |
| `dev` | integration | spec, fix and docs PRs, "Rebase and merge" |

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
