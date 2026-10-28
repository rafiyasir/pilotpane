# Spec 034: Pause that the host and the viewer both understand

Status: In progress | Package(s): protocol, host, viewer | Depends on: 007, 016

## Goal

When sharing is paused, the host never shows a PIN that cannot be used, and a viewer that is waiting comes back by itself when sharing resumes. No page reload, no minimising the host window to find the Resume button.

## Why (found in real use)

1. Pause closes the LAN listeners (`server.sync([])`) and refuses sockets, but `bringToFront()` and `showPinWindow()` in `controller.ts` still open the big PIN screen. The PIN looks live and the viewer cannot even load the page.
2. A pause sends `bye host-stopped`. The viewer shows "closed or paused" and stops retrying until the user clicks Reconnect or reloads, so a resume goes unnoticed.

## Scope

- In: no PIN window while paused; Resume reachable from the paused screen; a `paused` reason on `bye`; the viewer keeps retrying after a pause (existing backoff, last frame kept).
- Out: the first-close notice and a Quit button in the host window (no confirmed design, see spec 035); starting the capture engine only when a viewer pairs (spec 031).

## Screens

- Host: paused (Confirmed). The existing "Sharing is paused" card with "Resume sharing" is what the user sees. No new UI.
- Viewer: reconnecting (Confirmed). Reused with the text "Sharing is paused on <host>. Waiting for it to resume."
- Viewer: error (Confirmed). Still used for `host-stopped`, `kicked` and `capture-failed`.

## Protocol messages

Changed: host to viewer `bye`, `reason` gains `paused` (now `host-stopped | kicked | new-pin | capture-failed | paused`). Validation: unknown reasons are still rejected. `PROTOCOL_VERSION` goes from 2 to 3 because an old viewer would drop the new reason. Needs ADR-017.

## Design (SOLID)

- `session.ts`: `kick(reason)` accepts `paused`. No other change.
- `controller.ts`: one place decides whether the PIN window may show (`canShowPin()`: not paused, not quitting). `bringToFront`, `showPinWindow` and the startup call use it. On `pause` the PIN window closes. On `resume`, if no viewer is connected, the PIN window opens again.
- Viewer `handleBye`: for `paused` it keeps the token, shows the reconnecting banner and calls the existing retry path instead of stopping.
- Nothing new is injected; the existing `Controller` and `SessionManager` tests keep running under plain `node --test`.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. protocol: add `paused` to the `bye` reason (`messages.ts`, `parse.ts`), bump `PROTOCOL_VERSION` to 3, tests for accept and reject; ADR-017 in `docs/DECISIONS.md` and the message table in `docs/ARCHITECTURE.md`.
2. host: `kick('paused')` on pause, `canShowPin()` guard, close the PIN window on pause, reopen on resume when no viewer; unit test the guard where it can run without Electron.
3. viewer: handle `bye paused` with the retry loop and the reconnecting text; retry at once when the host answers again.
4. docs: journal page via `/learn 034`, roadmap row to Done in `/prepare-pr`.

## Done when

- [ ] After Pause, opening the app (tray click, second launch) shows no PIN window and shows the paused card with "Resume sharing".
- [ ] After Resume with no viewer connected, the PIN window shows again.
- [ ] A streaming viewer that gets a pause keeps the last frame, shows the paused text and reconnects without a reload after Resume, using its resume token (no PIN).
- [ ] A viewer that opens the page while sharing is paused keeps retrying and connects after Resume.
- [ ] `parseServerMessage` accepts `bye` with `paused` and still rejects unknown reasons.
- [ ] `PROTOCOL_VERSION` is 3 and ADR-017 exists.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` pass.

## Manual test guide

Filled in by `/build`.

- **Host (Git Bash):** `pnpm start`, then Pause from the host window.
- **Viewer (Windows 8 / Chrome 109 laptop):** see the Done-when items above.
- **Expected results** for each step.
- **Failure case:** pause while a viewer is streaming, then quit the host from the tray instead of resuming; the viewer must show the normal reconnect messages, not a paused text.
