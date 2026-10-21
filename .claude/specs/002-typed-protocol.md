# Spec 002: Typed protocol

Status: Done | Package(s): protocol | Depends on: 001

Part of v0.1, "See the screen". Reconstructed from the original v0.1 spec after it was split; the acceptance criteria (AC-N) are the ones from that spec.

## Goal

Every network message has a type and a validator, and the PIN proof works in Node and Chrome 109.

## Scope

- In: Message types, `parse.ts` validators, own SHA-256, PIN proof, internal host types.
- Out: Sockets and pairing logic (specs 003 and 004).

## Screens

No screens.

## Protocol messages

All v0.1 messages: `hello`, `pair`, `paired`, `pair-failed`, `resume`, `busy`, `offer`, `answer`, `ice`, `quality`, `set-quality`, `stats`, `bye`, `leave`. See ARCHITECTURE.md.

## Design (SOLID)

- `messages.ts` (types), `parse.ts` (validation, never throws), `sha256.ts`, `pin.ts`: one job each.
- No `node:` imports outside `*.test.ts`; ES2020 target.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. Message types and constants
2. Parsers with size limits
3. Own SHA-256 and PIN proof
4. Tests for parsers and hash vectors

## Done when

- [x] Invalid or oversized input returns a reason and never throws.
- [x] SHA-256 matches the standard test vectors.
- [x] The package compiles for Node and for Chrome 109 (ES2020, no `node:` imports).

## Manual test guide

- **Host (Git Bash):** `pnpm test`
- **Viewer (Windows 8 / Chrome 109):** Nothing to open.
- **Failure case:** The parser tests feed malformed JSON and unknown types; all are rejected with a reason.
