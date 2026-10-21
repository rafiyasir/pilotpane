---
description: Create a lean spec and its branch. Usage: /create-spec 009 host-interfaces
argument-hint: "<NNN> <slug>"
allowed-tools: Read, Write, Edit, Glob, Bash(git:*)
---

Input: $ARGUMENTS

1. Run `git status --porcelain`. If anything is uncommitted, stop and ask to commit or stash.
2. Parse `NNN` (3 digits) and `slug` (kebab-case, max 40 chars). Ask if unclear.
3. Read @docs/ROADMAP.md: confirm the spec exists there and is not Done. If it is not listed, ask whether to add it.
4. `git checkout dev && git pull --ff-only`, then `git checkout -b spec/NNN-slug` (append `-2` if the name exists).
5. Read only what the spec needs: @CLAUDE.md, the relevant section of @docs/ARCHITECTURE.md, the @DESIGN.md inventory rows for any screens, and the specs this one depends on.
6. Write `.claude/specs/NNN-slug.md` from `.claude/specs/_TEMPLATE.md`. Keep it under about 120 lines. Tasks must be commit-sized. "Done when" must be testable.
   Design gate: if a needed screen is not "Confirmed" in the DESIGN.md inventory, stop and say which screen needs a design. Do not invent UI.
   Dependency gate: any new package needs an ADR in @docs/DECISIONS.md and must pass the policy in @CLAUDE.md.
7. Set the spec's row in @docs/ROADMAP.md to "In progress".
8. Reply with: branch, spec file, package(s), task count. Do not paste the whole spec.
