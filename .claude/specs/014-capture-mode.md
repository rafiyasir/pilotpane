# Spec 014: Capture mode and shortcut bar

Status: Done | Package(s): protocol, viewer | Depends on: 011, 013

Part of v0.3, "Keyboard". Spec 013 types keys on the host; this adds a way to send the combinations a browser on plain HTTP keeps for itself.

## Goal

While controlling the host, the viewer user can send Alt+Tab, Win, Alt+F4 and Ctrl+W to the host with one tap on a shortcut bar, and sees a clear hint the first time.

## Scope

- In: a "Shortcuts" toolbar chip, a bar of four chips (Alt+Tab, Win, Alt+F4, Ctrl+W) shown only while Controlling, each chip sending its combination once as key down then key up over the existing `input` channel, a bar that can be dragged by a grip, resized by a corner handle (75% to 200%) and faded with an opacity slider (40% to 100%), kept per browser (`pilotpane.shortcutBar`), a one-time "Some keys stay with this browser" hint, the bar and chip hidden or disabled while Viewing and Watching only, keeping control when a chip is used.
- Out: Esc chip (Esc always lets go), Ctrl+Alt+Del (Windows blocks it from software), held modifiers on the bar, Keyboard Lock (secure context only, ADR-004; revisit with HTTPS in 018), on-screen keyboard, new protocol messages.

## Screens

From the DESIGN.md inventory, section "Keyboard shortcuts (v0.3)":

- Shortcut bar (canvas name "Shortcut bar", Confirmed): bar, toolbar chip, Viewing and Watching only states, first-time hint.
- Reuses Controlling and Released from "Mouse hint" (Confirmed).

## Protocol messages

None. A combination is the existing `key` messages in order, for example Alt+Tab is `AltLeft` down, `Tab` down, `Tab` up, `AltLeft` up. All four codes are already in the shared table (`keys.ts`). Messages still go through the data channel only.

## Design (SOLID)

- New module `packages/protocol/src/shortcuts.ts` (one job): the list of shortcuts and `comboMessages(codes)`, a pure function returning the ordered `InputMessage`s. No DOM, so it is testable under `node --test` (viewer code has no test runner, like `pointer-map.ts`).
- New module `apps/viewer/src/shortcut-bar.ts` (one job): builds the bar and toolbar chip state from `ControlUi` state (hidden unless Controlling, chip disabled otherwise), calls an injected `send`. Chips use `pointerdown` with `preventDefault` so the click does not blur the page or lift held keys.
- `main.ts` (viewer) wires it to the existing Controlling state and `KeyboardController`. If any key is held (`KeyTracker`), the combo is sent after it, never mixed in.
- First-time hint stored like the mouse hint, through the existing safe storage helper (`pilotpane.shortcutHintSeen`), page works without storage.
- No secure-context APIs. ES2020, Chrome 109 safe. Colours from `theme.css` tokens only.
- Pointer lock: a locked mouse is hidden and cannot click the bar. Pressing the toolbar chord (Ctrl+Alt+Shift) while controlling calls `PointerController.toggleLock()`: the lock is freed and control continues with the plain mouse (ADR-013); pressing the chord again locks the pointer once more. Mouse events on `[data-no-control]` elements (toolbar, bar) are not sent to the host.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `feat(protocol): add shortcut combos` with `shortcuts.ts` and tests (each combo ends with every key up, modifier goes down first and up last, only known codes).
2. `feat(viewer): add shortcut bar` with `shortcut-bar.ts`, markup and styles in `index.html` and `viewer.css`, wiring in `main.ts`, first-time hint, bar behaviour with pointer lock.
3. `docs: document the shortcut bar`: ARCHITECTURE note, DESIGN.md section, the manual test guide below.

## Done when

- [x] `comboMessages` returns the right ordered `key` messages for all four shortcuts; tests pass under plain `node --test`.
- [ ] The bar and the toolbar "Shortcuts" chip appear as designed in all four themes, and the chip is disabled while Viewing and Watching only.
- [ ] While Controlling, Alt+Tab, Win, Alt+F4 and Ctrl+W each do the matching thing on the host.
- [ ] Using a chip does not end control, and no key stays stuck on the host afterwards.
- [ ] The bar sends nothing while Viewing, when the data channel is closed, or when the host has no input.
- [ ] The bar can be dragged, resized and faded, stays inside the stream, and keeps its place, size and opacity after a reload.
- [ ] The first-time hint shows once per browser, and the page works with storage blocked.
- [x] No new network message, no new package, and `pnpm scan` is clean.

## Manual test guide

**Host (Git Bash)**

1. Quit any running PilotPane, then `pnpm build` (this also rebuilds the input helper) and `pnpm start`.
2. Open Notepad on the host and keep a second window (for example File Explorer) open.
3. Note the address and PIN on the host.

**Viewer (Windows 8 / Chrome 109 laptop)**

1. Open the address in Chrome, enter the PIN, wait for the picture.
2. Before clicking the picture: the toolbar (tab at the top) has a greyed-out "Shortcuts" button.
3. Click the picture. Badge says "Controlling" and the pill reads "Esc to let go · Ctrl+Alt+Shift for toolbar". Card "Some keys stay with this browser." appears above the "Esc to let go" pill, then fades. Reload and control again later: it does not come back.
4. Press Ctrl+Alt+Shift. The toolbar opens and the mouse pointer appears (control continues, badge still "Controlling"). Click "Shortcuts": the button is highlighted and a bar with Alt+Tab, Win, Alt+F4, Ctrl+W shows near the bottom.
5. Click Alt+Tab: the host switches window. Click Win: the Start menu opens (click Win again to close it). Open Notepad and click Alt+F4: Notepad closes (or asks to save). Click Ctrl+W in a browser tab on the host: the tab closes.
6. When you are done with the bar (also after step 9, if you want to test the bar first), press Ctrl+Alt+Shift again: the toolbar closes, your own pointer disappears and the mouse is locked again, still in control.
7. While using the bar, typing still reaches the host (type in Notepad) and clicking a chip never clicks on the host screen.
8. Press Esc: control ends, badge "Viewing", the bar hides and "Shortcuts" greys out. Click the picture again: control returns, and the bar comes back if it was open.
9. Drag the bar by the dots on its left: it follows the pointer and stays inside the picture. Drag the corner at its bottom right to make it smaller and bigger. Move the slider: the bar fades but stays readable and clickable. None of this clicks on the host. Reload, take control and open the bar again: same place, size and opacity.
10. Try the four themes: bar, chips and the pressed "Shortcuts" button are readable in each.

**Failure cases**

- Disconnect the Ethernet cable (or stop PilotPane on the host) while the bar is open: the page shows "Reconnecting", the bar hides, and nothing is left held on the host (Shift or Alt not stuck).
- Rename `apps/host/dist/helper/pilotpane-input.exe` temporarily and restart the host: the badge says "Watching only" and "Shortcuts" stays greyed out.
- Block storage in Chrome (Settings, Cookies, block all): the page still works; the first-time card may show each time.
