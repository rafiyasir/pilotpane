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
- Check the README renders well on GitHub and the license is correct.
- Make sure issues are enabled and `SECURITY.md` says how to report problems.
