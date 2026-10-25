# What is public and what stays private

This repository is public from its first commit. Git keeps history forever, so anything committed once should be treated as published, even if it is deleted later.

## Public (committed)

- Source code, tests, build scripts.
- `docs/`: overview, architecture, decisions, security, connection guides, roadmap.
- `docs/journal/`: curated learning-journal entries (written to be read by others).
- `docs/design/`: exported mockups and logo files, once exported.
- `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `CLAUDE.md`.
- Shared Claude Code setup: `.claude/commands/`, `.claude/skills/`, `.claude/specs/`, `.claude/hooks/`, `.claude/settings.json`, plus `DESIGN.md`, `design/` and `RUNBOOK.md`.

## Private (never committed)

| What                                                            | Where it goes                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Personal notes, journal drafts, prompts, to-dos                 | `private/` (gitignored)                                                                   |
| `.env` files, tokens, keys of any kind                          | not in the repo                                                                           |
| Claude Code personal settings                                   | `.claude/settings.local.json` (gitignored)                                                |
| Logs, captured frames, debug dumps                              | gitignored (`*.log`, `logs/`, `captures/`)                                                |
| Real home IPs, MAC addresses, Wi-Fi names, computer names       | replace with documentation examples (`192.168.1.12`, `DESKTOP-VICTUS` style placeholders) |
| Screenshots showing your desktop, files, notifications or chats | crop or redact before adding to docs                                                      |

## Before every push

1. `git status` and `git diff --staged`: read what you are committing, then run `pnpm scan -- --staged`.
2. `pnpm scan` checks every tracked file for keys, tokens, real IPs, emails and `C:\Users\<name>` paths. Also read the diff yourself for names and anything it cannot recognise.
3. Screenshots: check every corner (taskbar, notifications, open tabs).

## Before announcing the repo

- Run `pnpm scan -- --history`: it checks every line added in every commit on every branch. It reads file contents only, so also check commit author emails with `git log --format=%ae%n%ce | sort -u`.
- A finding is removed or, for a documentation example, added to `scripts/secret-scan.allow.json` as a reviewed entry. A line can also carry `scan:ignore`. The scanner is our own script (`scripts/scan-secrets.mjs`, ADR-002). Switch on GitHub secret scanning in the repo settings once the repo is public.
- Also check tag authors: `git for-each-ref --format='%(refname:short) %(taggeremail)' refs/tags`. Commit and tag authors must be your `@users.noreply.github.com` address (set `git config user.email` for the repo, and tick "Keep my email addresses private" and "Block command line pushes that expose my email" in your GitHub email settings).
- `pnpm scan` does not read commit authors, tag authors or commit messages. Check them with the two commands above.
- If you ever rewrite history to remove an email, force-pushing branches and tags is not enough. GitHub keeps the old pull request commits under `refs/pull/*` and you cannot change them. Check with `git ls-remote origin`: for a public repo there must be no `refs/pull/*` lines that point at old commits. The clean fix is a new empty repo with the same name and a push of the cleaned branches and tags. Keep the old repo private and archived. When recreating, use `if [ ... ]; then ...; fi` in the `--env-filter`, not `[ ... ] && ...` as the last line, because a false test makes filter-branch fail. Tags need their tagger rewritten too (`git tag -f -a <name> -m <msg> <name>^{commit}`).
- Check the README renders well on GitHub and the license is correct.
- Make sure issues are enabled and `SECURITY.md` says how to report problems.
