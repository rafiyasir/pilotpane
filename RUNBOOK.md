# Runbook

## 1. One-time setup (Windows 11, Git Bash)

- Node 22.12 or newer, Git, VS Code and Claude Code. Enable pnpm with `corepack enable` (the repo pins pnpm 10).
- Clone the repo, then in Git Bash:
  ```bash
  pnpm install
  pnpm setup-hooks      # enables the commit message check in .githooks/
  pnpm test             # builds, then runs all tests
  pnpm start            # launches the host
  ```
- **Firewall:** the first start shows a Windows Defender Firewall prompt for Electron. Tick Private networks (and Public for a direct cable, which Windows treats as Public) and click Allow access. Missed it? Windows Security > Firewall & network protection > Allow an app through firewall > Electron. More in `docs/CONNECTIONS.md`.
- **GitHub:** in the repo settings under Pull Requests enable only "Allow rebase merging" (plus "Allow merge commits" for release PRs into `main`) and "Automatically delete head branches". Protect `main` and `dev` (require a PR).
- **Viewer laptop:** nothing to install. Chrome 109 on Windows 8 is the reference viewer.

## 2. The loop for every spec

In Claude Code, from the repo root, in a fresh session (`/clear`):

1. `/create-spec 009 host-interfaces` creates `spec/009-host-interfaces` from `dev` and writes the spec.
2. `/build 009` implements it, runs `pnpm test`, and prints a manual test guide.
3. Test with the guide: host steps in Git Bash, viewer steps on the old laptop. Report problems in plain words; they get fixed.
4. `/learn 009` writes the journal page `docs/journal/specs/009.js`. Open `docs/journal/index.html` and look at it.
5. `/prepare-pr` marks the spec Done, proposes logical commits (protocol, host, viewer, tests, docs), pushes, and prints the PR title, body and compare link `https://github.com/rafiyasir/pilotpane/compare/dev...<branch>?expand=1`.
6. Open the link, create the PR into `dev`, wait for CI, merge with **Rebase and merge**.
7. `/post-merge` verifies the merge, deletes the branch, and tags and pushes `spec-009-done`.

Optional for pairing, input and network specs: `/review 009` before `/prepare-pr`.

## 3. When something goes wrong

- **Not merged yet:** fix on the branch and rerun `/prepare-pr`, or delete the branch and redo the spec.
- **Merged, bug found:** `git checkout dev && git pull --ff-only && git checkout -b fix/short-name`, describe the bug, test, then `/prepare-pr` and `/post-merge` (no spec tag for `fix/` branches).
- **The spec was wrong:** edit the spec file, note why at the top, and rebuild.
- **A hook blocked a command:** read the message. Pushes to `main` and `dev`, force pushes, `gh pr create/merge`, `git add .`, anything touching `private/`, and deletes inside `.claude/specs/`, `docs/` or `apps/host/assets/` are blocked on purpose. Do those by hand if you really mean them.
- **commit-msg rejected a commit:** use `type(scope): description` under 72 characters and remove any Co-Authored-By line.
- **Host will not start or the page does not load:** `PILOTPANE_LOG=debug pnpm start`, copy the terminal output; on the viewer press F12 > Console and copy red lines.
- **CI fails on format:** run `pnpm format` and commit the result.

## 4. Release steps

1. All specs of the version are Done in `docs/ROADMAP.md` and their manual tests passed on real hardware, including the Windows 8 / Chrome 109 viewer.
2. `/release X.Y.Z` bumps versions, updates `CHANGELOG.md`, pushes `chore/release-X.Y.Z`, and prints the PR title and body.
3. Merge the release branch into `dev` (Rebase and merge), then open the `main...dev` compare link it prints and merge that PR with **Create a merge commit**.
4. Tell `/release` the PR is merged: it tags `vX.Y.Z` on `main` and pushes the tag.
5. If `main` has commits `dev` lacks, merge `main` back into `dev`.
