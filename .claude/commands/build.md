---
description: Build a spec end to end, test it, and hand over a manual test guide. Usage: /build 009
argument-hint: "<NNN>"
---

Input: $ARGUMENTS

Goal: implement the spec following the guidelines, verify it, and give the user a clear manual test guide. Work efficiently: read only what is needed, no subagents, no repeated review rounds.

1. Find `.claude/specs/$ARGUMENTS-*.md`. Stop if missing. Confirm the current branch is `spec/$ARGUMENTS-...`.
2. Read the spec, @CLAUDE.md, and only the matching skills: protocol -> `.claude/skills/protocol-patterns/SKILL.md`, host -> `host-patterns`, viewer -> `viewer-patterns`. For UI, read @DESIGN.md.
3. Print the task list from the spec (one line each) and start. If the spec is marked "plan-first", show a short plan (also saved in `.claude/plans/`) and wait for approval before coding.
4. Implement task by task, in commit order: protocol -> host -> viewer -> tests -> docs. Follow the patterns exactly. New network messages go in `packages/protocol` first (type, parser, test).
5. Tests, focused (see @docs/ENGINEERING_PRACTICES.md "Testing scope"): unit tests for protocol parsers and for host modules that run without Electron. No snapshot tests.
6. Run `pnpm build`, then `pnpm test` (it builds first), then `pnpm format:check`. Fix failures with a maximum of 3 attempts per failure, then report it instead of looping.
7. Run the "Self-check before handing over" list from @CLAUDE.md. Fix anything that fails.
8. Write the manual test guide into the spec's "Manual test guide" section:
   - Host steps in Git Bash (exact commands, for example `pnpm start` or `PILOTPANE_LOG=debug pnpm start`).
   - Viewer steps on the Windows 8 / Chrome 109 laptop: what to open, what to click, what should appear.
   - Expected results for each step and at least one failure case (wrong PIN, cable unplugged, port busy, and so on).
9. Do not commit. Reply with: what was built (short), test results, the manual test guide, and "Test it, tell me any issue, then run /learn NNN and /prepare-pr".

If the user reports a problem after testing, fix it with the smallest change, rerun the affected tests, and update the guide if the steps changed. Keep a short list of the bugs they reported: /learn uses it.
