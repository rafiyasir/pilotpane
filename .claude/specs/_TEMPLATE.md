# Spec NNN: <Title>

Status: Todo | Package(s): <protocol / host / viewer / all> | Depends on: <NNN, NNN>

## Goal

One or two sentences: what the user or developer can do after this spec.

## Scope

- In: ...
- Out: ... (name what is deliberately left for later)

## Screens

For each screen: canvas screen name from the DESIGN.md inventory and its status.
If any status is not "Confirmed", stop: the screen needs a design first.
Write "No screens" for protocol, tooling or main-process specs.

## Protocol messages

New or changed messages in `packages/protocol`: direction, type, fields, validation limits. Changing a message shape bumps `protocol` and needs a DECISIONS.md entry.
Write "None" if none.

## Design (SOLID)

- Interfaces added or implemented (for example `ScreenCapturer`, `InputInjector`).
- One responsibility per module: name each new module and its single job.
- What is injected (and into what), so the module runs under plain `node --test` without Electron.

## New dependencies

Package and one-line reason, with the DECISIONS.md entry. Write "None" if none (the usual answer).

## Tasks (each task = one logical commit)

Order: protocol, host, viewer, tests, docs.

1. ...
2. ...

## Done when

- [ ] Testable statement
- [ ] Testable statement

## Manual test guide

Filled in by `/build`.

- **Host (Git Bash):** exact commands.
- **Viewer (Windows 8 / Chrome 109 laptop):** what to open, click and look for.
- **Expected results** for each step.
- **Failure case** (at least one): what to break, and what should happen.
