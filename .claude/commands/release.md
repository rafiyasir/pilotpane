---
description: Release a version in three phases: prepare, tag, then sign and publish. Usage: /release 0.5.0
argument-hint: "<X.Y.Z>"
allowed-tools: Read, Edit, Bash(git:*), Bash(pnpm:*), Bash(node:*), Bash(grep:*), Bash(curl:*)
---

Input: $ARGUMENTS

Rules for every phase: never create or merge a PR, never push to `main` or `dev`, never read or print the signing key, never rebuild a release by hand, never re-push a tag. Pushing a work branch or a version tag is fine. Check a release through the GitHub API, never with `curl -I` or another request to the installer link, because that counts as a download. The steps below were proven by the 0.1.0 to 0.4.1 releases; see @docs/DEPLOYMENT.md.

If `$ARGUMENTS` is empty, list the commits since the last release (`git fetch origin --tags`, then `git log --format=%s <last v tag>..origin/dev`) and propose a version: only fixes and docs give a patch bump, any new feature gives a minor bump. Wait for the user to confirm it.

## Phase 1, prepare (on a `chore/release-X.Y.Z` branch from `dev`)

1. Run `git status --porcelain`; stop if dirty. `git fetch origin --tags`, `git checkout dev && git pull --ff-only`, then `git checkout -b chore/release-$ARGUMENTS` and confirm with `git branch --show-current`.
2. Check @docs/ROADMAP.md: every spec of this version is Done. If not, list the open ones and stop. Remind the user that the manual test steps must have passed on real hardware, including the Windows 8 / Chrome 109 viewer.
3. Set `version` to `$ARGUMENTS` in the root `package.json` and in every `apps/*/package.json` and `packages/*/package.json` (four files today). Do not touch dependencies. Then run `node scripts/release-ci.mjs check-tag v$ARGUMENTS`; it must print that the tag matches.
4. Add a section at the top of `CHANGELOG.md` in the existing style: `## [X.Y.Z] Title`, plain bullets, no date. Write one bullet per feature or fix, not one per commit, from `git log --format=%s <last v tag>..dev`. Plain English, no em dashes. Update the status line in `README.md` (`**Status: vX.Y.Z, an early release.**`) and anything out of date in `docs/ROADMAP.md`.
5. Run `pnpm scan -- --history`, `pnpm test` and `pnpm format:check` once. Report failures.
6. Commit with explicit paths, in two commits: `chore(release): bump version to X.Y.Z` (the package.json files) and `docs: write the X.Y.Z changelog` (`CHANGELOG.md`, `README.md`, and any roadmap change). Then `git push -u origin chore/release-$ARGUMENTS`.
7. Print a PR title and body for a PR into `dev` (base `dev`, "Rebase and merge"). Tell the user to merge it and say so.
8. After they say it is merged: `git checkout dev && git pull --ff-only`, then print a PR title and body for `dev` into `main`: title `chore(release): release X.Y.Z`, body with the changelog lines, test steps and checklist. The compare link is `https://github.com/rafiyasir/pilotpane/compare/main...dev?expand=1`. Tell the user to merge it with "Create a merge commit".

## Phase 2, tag (after the user says `dev` is merged into `main`)

1. `git fetch origin --prune && git checkout main && git pull --ff-only`.
2. Verify: `grep '"version"' package.json` shows `$ARGUMENTS`, and `node scripts/release-ci.mjs check-tag v$ARGUMENTS` passes. If either fails, stop and say what is wrong.
3. `git tag -a vX.Y.Z -m "PilotPane X.Y.Z"` and `git push origin vX.Y.Z`. The tag starts `.github/workflows/release.yml`, which builds the installer and zip into a **draft** release.
4. Tell the user to watch the Actions tab. If the run fails, ask for the failing step and its last lines, and stop.
5. When it is green, tell the user to download the three draft files (the installer, the zip and `SHA256SUMS`) into a folder outside the repo, for example `/d/dream/pp-release/X.Y.Z`, and to say when they are there.

## Phase 3, sign and publish (the signing key stays on the user's machine)

1. `git fetch origin`, then `git checkout -b chore/site-X.Y.Z origin/main`, then `git branch --show-current`. It must print the new branch name; if it does not, stop.
2. Ask for the key path (usually `private/update-key/update-private.pem`) and up to three short notes of at most 120 characters. Run `pnpm release:sign -- --version X.Y.Z --dir <folder> --key <path> --note "..."`. The GitHub CLI is not needed with `--dir`. If it refuses with a hash mismatch, stop and tell the user to download the three files again. Do not retry or work around it.
3. `git status --short` must show only `docs/index.html` and `docs/update/manifest.json` as modified. `git diff docs/update/manifest.json` must change only `version`, `url`, `sha256`, `size`, `notes` and `signature`. If not, stop.
4. `git add docs/update/manifest.json docs/index.html`, `pnpm scan -- --staged`, then `git commit -m "chore(site): publish X.Y.Z"` and `git push -u origin chore/site-X.Y.Z`.
5. Print a PR title and body for the site PR. Say clearly that its base must be **`main`**, not `dev`, even though `dev` is the default branch, and that it is merged with "Create a merge commit". If it went to `dev` by mistake, the fix is a `dev` into `main` PR.
6. After the user says it is merged, tell them to open the draft release (Edit, paste the notes, keep "Set as the latest release" ticked, Publish release). Publish only after the site PR is merged.
7. Verify without touching the download counter:
   - `curl -s https://api.github.com/repos/rafiyasir/pilotpane/releases/latest` shows `"tag_name": "vX.Y.Z"` and `"draft": false`.
   - `curl -s https://rafiyasir.github.io/pilotpane/update/manifest.json` shows the new `version` and `sha256`. Pages can take a minute or two.
8. Tell the user to test like a user: with the previous version installed, click Check for updates, Download, then Restart to install, and confirm the app comes back on the new version. If it does not, read `%TEMP%\PilotPane-setup.log`. Install by hand only to test the installer itself.
9. Clean up: `git checkout dev && git pull --ff-only`, `git branch -D chore/release-X.Y.Z chore/site-X.Y.Z`, and delete the download folder. No merge of `main` back into `dev` is needed. Never sign an older version after a newer one: the manifest names the newest.
