---
description: Optional single-pass check for risky specs (pairing, input injection, network messages). Usage: /review 010
argument-hint: "<NNN>"
allowed-tools: Read, Grep, Glob, Bash(git diff:*)
---

Input: $ARGUMENTS

1. Collect `git diff dev...HEAD` plus uncommitted changes. Stop if empty.
2. Read the spec and the self-check in @CLAUDE.md. Check the diff once for: LAN-only binding and `Host`/`Origin` checks still in place, every network message parsed in `packages/protocol` (no stray `JSON.parse`), PIN, proofs and tokens never logged or sent, input only over the WebRTC data channel, IPC sender checks, viewer code safe for Chrome 109 and plain HTTP, no personal data, no new dependency without an ADR.
3. Report findings as Critical / High / Low with file and line, plus one-line fixes. Keep it short. Verdict: OK or FIX FIRST.
4. Do not edit files until the user says to.
