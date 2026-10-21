---
description: Split changes into logical commits, push, and print a copyable PR title and body.
allowed-tools: Read, Edit, Bash(git:*), Bash(pnpm:*)
---

1. `git branch --show-current`. Stop if on `main` or `dev`. Extract `NNN` from `spec/NNN-slug` (`fix/` and `docs/` branches have no spec).
2. For a spec branch, check that `docs/journal/specs/NNN.js` exists. If it is missing, stop and remind the user to run `/learn NNN` first.
3. Mark the spec Done: set its row in @docs/ROADMAP.md and the spec file's Status line to "Done". Skip for `fix/` and `docs/` branches.
4. Review `git status` and `git diff`. Group changes into logical commits, one concern each, in this order: protocol, host, viewer, tests, docs. Conventional commits with scope: `feat(host): add tray menu`. Lowercase, imperative, under 72 chars. No AI attribution of any kind (no Co-Authored-By, no "Generated with").
5. Show the proposed commits as a list: message plus files. Wait for approval or edits.
6. For each commit: `git add <explicit paths>` (never `git add .`, never anything under `private/`), then `git commit -m`. Stop if anything unexpected is left unstaged and ask.
7. Run `pnpm test` and `pnpm format:check` once. If either fails, stop and report.
8. `git push -u origin <branch>`.
9. Print, each in its own code block so it can be copied:
   - PR title: plain English, no prefix, under 70 chars.
   - PR body in the shape of `.github/pull_request_template.md`: What (one paragraph from the spec goal), Changes (per package), How to test (the spec's manual test guide, condensed), Done when (each item ticked), Checklist, Screenshots (UI changes only).
   - Compare link, built from `git remote get-url origin`: `https://github.com/<owner>/<repo>/compare/dev...<branch>?expand=1`
10. Remind: create the PR on GitHub, merge with "Rebase and merge", then run `/post-merge`. Never create or merge the PR yourself.
