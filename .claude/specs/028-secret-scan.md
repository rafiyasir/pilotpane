# Spec 028: Secret scan

Status: Done | Package(s): tooling | Depends on: 027

## Goal

One command, `pnpm scan`, checks the repo for secrets and personal data before it goes public: keys, tokens, real IP addresses, email addresses and Windows user paths, in the current files and (with a flag) in all of git history. It is our own plain-Node script, so no scanner tool or account is needed (ADR-002).

## Scope

- In: a scanner script with a small rule set, scanning tracked files, staged changes or full history; clear output that never prints the secret itself; an allowlist for documentation examples and the public update key; `pnpm scan`; docs in `PUBLIC_PRIVATE.md`; a note in `/prepare-pr` and `/release` to run it.
- Out: entropy-based guessing of random strings, scanning binaries, rewriting history (the scan only reports), a git hook that blocks commits, GitHub secret scanning setup (done in repo settings after going public), CI job.

## Screens

No screens.

## Protocol messages

None.

## Design (SOLID)

- `scripts/lib/secret-scan.mjs`: pure, no I/O. `RULES` (id, description, regex), `scanText(text, { path, allow })` returns findings `{ rule, path, line, preview }` where `preview` is masked (first 4 characters, then `***`). Also `isAllowed(finding, allow)`.
  - Rules: private key blocks (`-----BEGIN ... PRIVATE KEY-----`), GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `github_pat_`), AWS access key ids, Slack tokens, generic `token|secret|password|apikey = "<16+ chars>"` assignments, email addresses, IPv4 addresses, Windows user paths (`C:\Users\<name>`, `/Users/<name>`, `/home/<name>`).
  - Allowed by default: documentation IPs used in the docs (`192.168.1.12`, `192.168.50.x`, `192.168.60.x`, `192.168.137.1`, `127.0.0.1`, `0.0.0.0`, version-like strings), placeholder paths (`<you>`, `<name>`, `%USERPROFILE%`), `noreply` emails, the author credit email-free. A line containing `scan:ignore` is skipped.
- `scripts/lib/git-source.mjs`: lists what to scan using `git` through an injected `run(args)` function: `trackedFiles()`, `stagedDiff()`, `historyPatches()`. Skips `private/`, lockfiles, images and other binary extensions, and files over 1 MB.
- `scripts/scan-secrets.mjs`: plain Node CLI. Modes: default (tracked files), `--staged` (added lines only), `--history` (added lines in every commit, reports the commit id). Prints `path:line  rule  preview`, a summary, and exits 1 on any finding, 0 when clean. `--allow <file>` is not needed: the allowlist lives in `scripts/secret-scan.allow.json` (rule + path or value), reviewed like code.
- Everything that runs git or reads files is injected, so tests use fakes under plain `node --test`.

## New dependencies

None. Node built-ins and the `git` already required by the workflow. No ADR needed beyond a one-line note under ADR-002's consequences in `PUBLIC_PRIVATE.md`; skip a new ADR unless the rule set grows into a design choice.

## Tasks (each task = one logical commit)

1. `scripts/lib/secret-scan.mjs` with rules, masking, allowlist logic, and tests with positive and negative samples for each rule (including that the preview never contains the full secret).
2. `scripts/lib/git-source.mjs` with injected `run`, binary and size filters, and tests with a fake `run`.
3. `scripts/scan-secrets.mjs` CLI (modes, output, exit codes), `scripts/secret-scan.allow.json`, `package.json` script `scan`; test of the exit codes with fakes.
4. Run it on the repo. Fix real findings (or allowlist documentation examples with a reason) and report anything found in history without rewriting it.
5. Docs: `PUBLIC_PRIVATE.md` ("Before every push" and "Before announcing the repo" use `pnpm scan` and `pnpm scan -- --history` instead of gitleaks), `CLAUDE.md` self-check line, `/prepare-pr` and `/release` commands, `ROADMAP.md`, CHANGELOG.

## Done when

- [ ] `pnpm scan` exits 0 on a clean tree and 1 when a file contains a test private key block, a `ghp_` token, a non-documentation IPv4 address, an email address or a `C:\Users\<name>` path.
- [ ] Output shows file, line and rule, and never the full secret (masked preview only).
- [ ] `--staged` checks only added lines of staged changes; `--history` checks added lines in all commits and names the commit.
- [ ] Documentation example IPs, the public update key and `<you>` style placeholders do not trigger findings; a line with `scan:ignore` is skipped.
- [ ] `private/`, lockfiles, binary files and files over 1 MB are skipped.
- [ ] The scan runs on the real repo, and the result (clean, or the findings and what was done) is written in the manual test notes.
- [ ] Unit tests cover each rule, masking, allowlist, mode selection and exit codes, without git or the file system.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test` pass.

## Manual test guide

Tooling only: nothing to check on the Windows 8 / Chrome 109 viewer laptop.

**Host (Git Bash), from the repo root:**

1. `pnpm scan`. Expect `No findings (tracked).` and exit code 0 (`echo $?`).
2. `pnpm scan -- --history`. Expect `No findings (history).` It reads file contents in all commits, not author emails.
3. `git log --format='%ae' | sort -u`. Expect a list of author emails. Decide whether a personal address in it is acceptable before going public (the scanner does not look at commit metadata).
4. Failure case (staged mode). Make a scratch file, stage it, scan, then undo:
   ```bash
   printf 'ip = 203.0.113.45\npath = C:\\Users\\jordan\\Desktop\n' > scratch.txt
   git add scratch.txt
   pnpm scan -- --staged; echo "exit $?"
   git reset -q scratch.txt && rm scratch.txt
   ```
   Expect `scratch.txt:1  ipv4  203.***`, `scratch.txt:2  user-path  jord***`, a summary on stderr and `exit 1`. The full values are never printed.
5. After step 4, `pnpm scan -- --staged` prints `No findings (staged).` with exit 0.
6. Ignore marker: put `// scan:ignore` at the end of a scratch line that holds an IP, stage it, and expect no finding for that line.
