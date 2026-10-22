---
description: Prepare a release from dev to main. Usage: /release 0.2.0
argument-hint: "<X.Y.Z>"
allowed-tools: Read, Edit, Bash(git:*), Bash(pnpm:*), Bash(node:*)
---

Input: $ARGUMENTS

Phase 1, prepare (on a `chore/release-X.Y.Z` branch from `dev`):

1. Run `git status --porcelain`; stop if dirty. `git checkout dev && git pull --ff-only`, then `git checkout -b chore/release-$ARGUMENTS`.
2. Check @docs/ROADMAP.md: every spec of this version is Done. If not, list the open ones and stop. Remind the user that the manual test steps must have passed on real hardware, including the Windows 8 / Chrome 109 viewer.
3. Set `version` to `$ARGUMENTS` in the root `package.json` and in every `apps/*/package.json` and `packages/*/package.json`. Do not touch dependencies.
4. Add a section to `CHANGELOG.md` (Keep a Changelog style, today's date) from `git log --format=%s <previous tag>..dev`, grouped as Added, Changed, Fixed. Plain English, no em dashes.
5. Run `pnpm scan -- --history`, `pnpm test` and `pnpm format:check` once. Report failures.
6. Commit with explicit paths: `chore: release vX.Y.Z`. Then `git push -u origin chore/release-$ARGUMENTS`. Tell the user to merge this branch into `dev` first (Rebase and merge).
7. Print a PR title and body for `dev` into `main` (what is in the release, the spec list, test steps passed, checklist) and the compare link `https://github.com/<owner>/<repo>/compare/main...dev?expand=1`. Tell the user to merge it with "Create a merge commit". Never create or merge a PR yourself.

Phase 2, after the user says the release PR is merged:

1. `git fetch origin --prune && git checkout main && git pull --ff-only`.
2. `git tag -a vX.Y.Z -m "PilotPane vX.Y.Z"` and `git push origin vX.Y.Z`. The tag starts `.github/workflows/release.yml`, which builds the installer and zip into a **draft** release (it stops if the tag and the `package.json` version differ).
3. Wait for the workflow to finish (`gh run watch`, or the Actions tab) and the draft release to appear. If it failed, stop and show the log.

Phase 3, sign and publish (the signing key stays on the user's machine; never read or print it):

1. `git checkout -b chore/site-X.Y.Z` from `main`.
2. Ask the user for the key path and up to three short notes, then run `pnpm release:sign -- --version X.Y.Z --key <path> --note "..."`. It needs the GitHub CLI logged in, or the three draft files downloaded into a folder and passed with `--dir`. If it refuses with a hash mismatch, stop: do not retry or work around it.
3. Commit `docs/update/manifest.json` and `docs/index.html` with explicit paths (`chore: publish vX.Y.Z download page and update manifest`), push the work branch, and print a PR title and body for a PR into `main` (merge commit).
4. Tell the user to merge it, then publish the draft release on GitHub (Edit, then Publish release) and open the download page to check it. If `dev` lacks anything from `main`, tell them to open a `main` into `dev` PR. Then `git checkout dev && git pull --ff-only`.
