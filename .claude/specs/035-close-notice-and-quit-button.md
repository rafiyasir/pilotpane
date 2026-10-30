# Spec 035: Close-to-tray notice and Quit button

Status: Done | Package(s): protocol, host | Depends on: 007, 034

Closing the host window only hides it (`controller.ts`, by design, so sharing continues from the tray), and the process stays in Task Manager. New users think the app did not close.

## Goal

People can tell that PilotPane is still running after they close its window, and can quit it from the host window without finding the tray menu.

## Scope

- In: a Card on the first close (the close is held, the window stays visible); a "Quit PilotPane" button in the footer; a confirm Card when Quit is used while a viewer is connected.
- Out: changing the close-to-tray behaviour itself; a tray balloon; a "Quit" shortcut key.

## Screens

All in `DESIGN.md` ("Close and quit"), all Confirmed:

- Host: first close (Card with "Keep in tray" and "Quit PilotPane").
- Host: ready, with the Quit button in the footer.
- Host: quit with viewer (Card with "Quit" and "Stay open").

## Protocol messages

No network messages. Internal only (`packages/protocol/src/host-internal.ts`):

- `HostState` gains `closeNotice: boolean` (the first-close Card is showing).
- `HostAction` gains `{ action: 'keep-in-tray' }`. `quit` already exists.

## Design (SOLID)

- `settings.ts`: `Settings` gains `closeNoticeSeen: boolean` (default `false`); `loadSettings` falls back to the default when missing or not a boolean.
- `controller.ts`: the host window `close` handler asks a small pure function `closeDecision(seen, quitting)` in a new `close-notice.ts` (single job: returns `quit`, `hide` or `hold`). On `hold` it keeps the window open and patches `closeNotice: true`. On `keep-in-tray` it saves `closeNoticeSeen: true`, clears `closeNotice` and hides the window. A second close while the Card shows counts as `keep-in-tray`.
- Renderer (`host.ts`, `index.html`, `host.css`): shows the two Cards and the footer button. Whether a viewer is connected is already in `state.viewer`, so the confirm Card is decided in the renderer and sends `quit` only after the user confirms. Main still treats `quit` as always valid.
- `close-notice.ts` has no Electron imports, so it runs under plain `node --test`.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `feat(protocol): add closeNotice state and keep-in-tray action` (types, plus the places that build a `HostState`).
2. `feat(host): remember that the close notice was seen` (`Settings.closeNoticeSeen`, load, save, test).
3. `feat(host): hold the first window close` (`close-notice.ts`, controller wiring, `keep-in-tray` handler, tests for `closeDecision`).
4. `feat(host): first-close card and Quit button in the host window` (HTML, CSS, `host.ts`; confirm Card when a viewer is connected).
5. `docs: add close and quit screens to the design inventory` (`DESIGN.md` rows and section, already drafted) and the manual test guide in this spec.

## Done when

- [ ] The first close keeps the window open and shows the "PilotPane is still running" Card; "Keep in tray" hides the window and later closes hide it with no Card.
- [ ] The choice survives a restart (`closeNoticeSeen` is in `settings.json`); a missing or invalid value counts as not seen.
- [ ] "Quit PilotPane" on the first-close Card, and the footer button with no viewer, end the app and all its processes (none left in Task Manager).
- [ ] With a viewer connected, the footer button shows the confirm Card; "Stay open" changes nothing, "Quit" ends the app and the viewer shows its reconnecting or stopped state.
- [ ] Tray "Quit PilotPane" still quits with no Card.
- [ ] The Cards read correctly in all four themes and use no new tokens.
- [ ] Unit tests cover `closeDecision` and `loadSettings` for `closeNoticeSeen`.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` pass.

## Manual test guide

Reset first: close PilotPane, then in Git Bash remove the flag so the first close happens again:

```bash
sed -i 's/"closeNoticeSeen": true/"closeNoticeSeen": false/' "$APPDATA/@pilotpane/host/settings.json" 2>/dev/null || true
pnpm start
```

(If the file is missing or has no flag, the notice is simply "not seen".)

**Host window, first close**

1. Click the window's X. Expected: the window stays open and the "PilotPane is still running" Card appears under the header. Sharing is unchanged.
2. Click **Keep in tray**. Expected: the window hides and the PilotPane icon is still near the clock (check behind the ^ arrow). Open it from the icon: no Card now.
3. Close the window again. Expected: it hides at once, no Card.
4. Quit from the tray, run `pnpm start`, close the window. Expected: no Card (the choice was remembered).

**Quit button, no viewer**

5. Reset as above, start, click **Quit PilotPane** in the footer. Expected: the app ends at once. In Task Manager no PilotPane or Electron process stays.
6. Reset, start, click X, then **Quit PilotPane** on the Card. Expected: the same, with no confirm.

**Quit button, with a viewer** (Windows 8 / Chrome 109 laptop)

7. On the viewer open the address and PIN shown on the host, wait for the picture.
8. On the host click **Quit PilotPane** in the footer. Expected: the "Quit PilotPane?" Card appears and the footer button gets an amber border. The picture keeps playing.
9. Click **Stay open**. Expected: the Card goes away, the picture keeps playing.
10. Click Quit again, then **Quit**. Expected: the host ends; the viewer shows its reconnecting banner with the last frame.

**Themes**

11. Switch through Cockpit, Daylight, Midnight and Contrast with the Card showing (use step 1 after a reset). Expected: the text is readable and the buttons look like the canvas.

**Failure cases**

- With the Card showing, click X again. Expected: counts as Keep in tray, window hides, no second Card.
- With the Quit confirm Card open, disconnect the viewer from the viewer side. Expected: the confirm Card disappears by itself.
- Tray menu **Quit PilotPane** with a viewer connected. Expected: quits at once with no Card (unchanged).
- Put garbage in settings: set `"closeNoticeSeen": "yes"` in `settings.json` and start. Expected: the app starts and the first close shows the Card.

## Release

Planned for 0.4.3.
