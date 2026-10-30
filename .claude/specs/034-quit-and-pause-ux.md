# Spec 034: Pause that the host and the viewer both understand

Status: Done | Package(s): protocol, host, viewer | Depends on: 007, 016

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

Host: `pnpm start` in Git Bash (the build runs first). Note the address and PIN. Viewer: Chrome on the Windows 8 laptop.

1. **Pair.** On the viewer open `http://<address>:7420/`, type the PIN. Expected: the screen streams and the host PIN window closes.
2. **Pause while streaming.** In the host window click Pause. Expected: the viewer keeps the last frame and shows "Sharing is paused on <host>. Waiting for it to resume." No Reconnect button, no error card. The host shows the paused card and **no** PIN window.
3. **Open the app while paused.** Click the tray icon, then run `pnpm start` again in a second Git Bash. Expected: the host window shows "Sharing is paused" with "Resume sharing"; the big PIN screen never appears.
4. **Resume.** Click "Resume sharing". Expected: the big PIN window appears briefly only if no viewer is connected; within about 10 s the viewer reconnects by itself (no PIN, no reload) and the picture returns, and the PIN window closes again.
5. **Waiting at the PIN form.** Close the viewer tab and open the address again (PIN form shown, do not type). On the host click Pause. Expected: the viewer card changes to "Sharing is paused" with the waiting text and keeps retrying. Click Resume: the PIN form comes back by itself. (A page reload while paused only shows Chrome's own "can't reach" page, because the listeners are closed.)
6. **Resume with nobody connected.** Close the viewer tab, Pause, then Resume. Expected: the PIN window shows again.

**Failure case:** stream, click Pause, then quit PilotPane from the tray without resuming. Expected: the viewer first shows the paused text, then on the next attempt (up to 10 s) changes to "Can't reach the host" with the attempt counter (the normal reconnect text, not the paused one). Also: Quit from the tray while streaming (no pause) still shows "The host stopped sharing".

## Release

Planned for 0.4.3. It changes `PROTOCOL_VERSION` (2 to 3), so say so in the changelog.
