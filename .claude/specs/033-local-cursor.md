# Spec 033: Local cursor on the viewer (DRAFT)

Status: Todo | Package(s): viewer, maybe protocol | Depends on: 011, 031

Draft from real use: the viewer's mouse does not feel like the host's. We do not yet know which part feels wrong, so this spec is blocked on that answer.

## Goal

The pointer on the viewer reacts at once, with the host's speed and cursor shape, even when the video is delayed.

## Findings so far

- The cursor you see is part of the video, so it trails your hand by the whole video delay (ADR-016 named a local cursor as a possible later step).
- In pointer lock the viewer adds `movementX / videoWidth`, so the speed depends on the window size and there is no Windows acceleration curve.
- The click that takes control is swallowed on purpose; moves go through one reliable ordered channel, which can stall behind a backed-up queue.

## Open question (ask the maintainer before building)

Which of these feels wrong: delay between moving and seeing it, wrong speed or acceleration, the cursor shape (for example the I-beam over text), or clicks and drags.

## Scope

- In: a locally drawn cursor that moves at once; the host's cursor shape sent to the viewer if that is the problem; speed that matches the host.
- Out: relative-motion injection and anything beyond the symptom chosen above.

## Screens

None yet. A local cursor changes what the stream looks like, so check `DESIGN.md` and ask for a design if it adds UI.

## Protocol messages

Possibly a host to viewer `cursor` message (shape). If so: type and parser in `packages/protocol`, a test, a `PROTOCOL_VERSION` bump and an ADR.

## Done when (draft, finalised after the symptom is known)

- [ ] The chosen symptom is gone on the real laptops, described in the journal.
- [ ] Esc, pointer lock, the shortcut bar and `Ctrl+Alt+Shift` still work.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` pass.

## Release

Planned for 0.4.4 (keeps 0.5.0 for the v0.5 roadmap).
