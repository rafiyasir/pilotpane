---
description: Write the learning-journal page for a spec. Usage: /learn 009
argument-hint: "<NNN>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git:*), Bash(node:*)
---

Input: $ARGUMENTS

1. Confirm the current branch is `spec/$ARGUMENTS-...` and `.claude/specs/$ARGUMENTS-*.md` exists. Stop if not.
2. Read @docs/journal/README.md (the data shape), the spec, and the newest `docs/journal/specs/NNN.js` as a style reference. Read the changed source files only: `git diff --name-only dev...HEAD`.
3. Write `docs/journal/specs/$ARGUMENTS.js` in exactly that data shape:
   - `code`: real excerpts copied from the changed files, never invented. Add the file path of each.
   - `concepts[].resources`: official resources only (MDN, Node.js docs, Electron docs, W3C, IETF RFCs, TypeScript handbook, Microsoft docs). No blogs.
   - `bugs`: the problems the user reported while testing this spec (from this conversation). Leave out or use `[]` if none. Never invent bugs.
   - `commits`: the commit subjects of this branch from `git log --format=%s --reverse dev..HEAD`. If there are none yet, set `commitsNote`.
   - `mergedDate`: today's date. Plain English, no em dashes.
4. Add `'NNN.js'` to `docs/journal/specs/manifest.js`. If the roadmap changed, update `docs/journal/roadmap.js` to match @docs/ROADMAP.md.
5. `node --check` the files you touched.
6. Commit only those files with explicit paths: `git add docs/journal/specs/NNN.js docs/journal/specs/manifest.js` (plus `roadmap.js` if changed), then `git commit -m "docs(journal): add page for spec NNN"`.
7. Reply with the page title and the number of code excerpts, concepts and bugs. Remind the user to open `docs/journal/index.html` and look at it.
