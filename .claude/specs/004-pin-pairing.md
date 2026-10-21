# Spec 004: PIN pairing

Status: Done | Package(s): host, viewer | Depends on: 002, 003

Part of v0.1, "See the screen". Reconstructed from the original v0.1 spec after it was split; the acceptance criteria (AC-N) are the ones from that spec.

## Goal

A viewer proves it knows the PIN without sending it, and only one viewer connects at a time.

## Scope

- In: Nonce, PIN proof check, lockout, resume tokens, one-viewer rule, new PIN, viewer PIN form.
- Out: Video (spec 005).

## Screens

Viewer: PIN entry; Viewer: locked; Viewer: busy (all Confirmed).

## Protocol messages

Uses `hello`, `pair`, `paired`, `pair-failed`, `resume`, `busy` from spec 002.

## Design (SOLID)

- `pairing.ts` (PIN, nonce, lockout, tokens) and `session.ts` (relay, one viewer): no Electron imports.
- Time and random sources are injected so tests are fast and deterministic.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. Pairing with lockout and tokens
2. Viewer sessions and the busy rule
3. Viewer PIN form
4. Tests for pairing and sessions

## Done when

- [x] A wrong PIN shows "That PIN didn't match. N tries left."; 5 wrong PINs lock pairing for 60 s on both sides (AC-5).
- [x] A second viewer gets "Someone else is connected" (AC-9).
- [x] "New PIN" disconnects the viewer and asks for the new PIN (AC-11).

## Manual test guide

- **Host (Git Bash):** `pnpm start`; note the PIN.
- **Viewer (Windows 8 / Chrome 109):** Enter the PIN; then try a wrong one five times.
- **Failure case:** Five wrong PINs show the locked screen with a countdown.
