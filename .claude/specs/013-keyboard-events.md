# Spec 013: Keyboard events

Status: Done | Package(s): protocol, host, viewer | Depends on: 010, 011

Part of v0.3, "Keyboard". Typing on the viewer types on the host. Capture mode and the shortcut bar are 014.

## Goal

While the viewer is controlling the host (spec 011), key presses on the viewer are typed on the host's focused window, and held keys are released when control ends.

## Scope

- In: `key` messages on the existing `input` data channel, a table from `KeyboardEvent.code` to Windows virtual-key codes, mapping to `InputCommand` `key` (the helper already supports `K vk d`), releasing held keys when control ends, keys sent only while Controlling, Esc kept as "let go", key repeat handled, modifier state reset on blur.
- Out: capture mode, Keyboard Lock, the shortcut bar for Alt+Tab, Ctrl+Alt+Del, Win and similar (014); IME and non-US text entry by character (keys are physical, the host's own layout turns them into characters); clipboard (019); UAC secure desktop.

## Screens

No new screens. Reuses the Controlling and Released states from "Mouse hint" (spec 011, Confirmed). The "Keyboard capture mode and shortcut bar" screen is Not designed and belongs to 014, so nothing here depends on it.

## Protocol messages

Viewer to host, over the data channel only, parsed by `parseInputMessage`. Max 128 bytes like the others.

| Type  | Fields                       | Limits                                                         |
| ----- | ---------------------------- | -------------------------------------------------------------- |
| `key` | `code`: string, `down`: bool | `code` must be in the shared table (about 110 known W3C codes) |

The viewer sends the physical key (`KeyboardEvent.code`), not a character, so it works with any viewer layout and the host layout decides the character. The host turns `code` into a virtual-key code through `keyCodeToVk()` in `packages/protocol/src/keys.ts`; unknown codes are rejected by the parser. Existing messages keep their shape, so `PROTOCOL_VERSION` is not bumped (an old host drops `key`). Add a line to ADR-013's follow-up in `DECISIONS.md` (ADR-015: keys sent as physical codes, mapped on the host).

## Design (SOLID)

- New module `packages/protocol/src/keys.ts`: the `code` to `vk` table and `keyCodeToVk()`. Runs in Node and Chrome 109, no `node:` imports.
- `input.ts`: `InputMessage` gains the `key` variant; parser checks `code` against the table.
- `input-bridge.ts`: maps `key` to `{ kind: 'key', vk, down }`. Keys are never dropped (a lost key up sticks). `end()` already calls `releaseAll()`; confirm `HelperInputInjector` tracks held keys as well as buttons, and extend it if not.
- `apps/viewer/src/keyboard.ts` (new, one job): listens for `keydown` and `keyup` while Controlling, calls `preventDefault` for forwarded keys, ignores `e.repeat` (the host's OS repeats a held key itself), never forwards Esc, sends key up for every held key on release, blur or `visibilitychange`. Takes the send function and a "controlling" getter; no UI markup.
- Touched lightly: `main.ts` (viewer) wires `keyboard.ts` to the existing Controlling state; `controller.ts` needs no change beyond what the bridge does.
- No secure-context APIs are used. `KeyboardEvent.code` exists in Chrome 109.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `feat(protocol): add key table and key message` with tests (every table entry maps to 1..254, unknown code, missing field, non-boolean `down`, oversized, no duplicate vk for distinct codes except numpad/main pairs that are intentional).
2. `feat(host): send key messages through the input bridge` with tests (mapping, keys never dropped, `end()` releases held keys, Null injector).
3. Skipped: `HelperInputInjector` already tracks and releases held keys (`heldKeys`).
4. `feat(viewer): send keyboard input` with `keyboard.ts`, pure helper tests for the held-key set (repeat ignored, Esc not forwarded, release on blur), wiring in `main.ts`.
5. `docs: document keyboard input`: ARCHITECTURE messages paragraph, ADR-015, ROADMAP via `/prepare-pr`, the manual test guide below.

## Done when

- [x] `parseInputMessage` accepts `key` only with a known `code` and a boolean `down`, never throws; tests pass under plain `node --test`.
- [x] `keyCodeToVk` covers letters, digits, F1 to F12, arrows, Enter, Backspace, Tab, Space, Delete, Insert, Home, End, Page Up and Down, punctuation, numpad and both Shift, Ctrl, Alt and Win keys.
- [x] Keys travel only over the data channel; no key data on the WebSocket; `JSON.parse` of network input exists only in `packages/protocol`.
- [ ] Typing text, Enter, Backspace, arrows, Shift capitals, Ctrl+C and Ctrl+V work in a host Notepad window.
- [ ] Holding a key types it repeatedly on the host without a flood of messages from the viewer.
- [ ] Esc still lets go of control and is not typed on the host.
- [ ] Keys are not forwarded while the viewer is Viewing, and not when the host has no input helper.
- [ ] Held keys (for example Shift) are released on the host when control ends, the page loses focus, the viewer leaves or the connection drops.
- [ ] The viewer stays ES2020 and Chrome 109 safe; `pnpm format:check`, `pnpm build`, `pnpm test` and `pnpm scan` pass.

## Manual test guide

Both laptops on one network (see docs/CONNECTIONS.md). On the host, open Notepad with an empty file and keep the host screen visible.

**Host (Git Bash)**

1. `pnpm build`
2. `PILOTPANE_LOG=debug pnpm start`. Expect the big PIN screen.

**Viewer (Windows 8 / Chrome 109 laptop)**

3. Open the address, type the PIN, click the picture to take control (badge **Controlling**). Click inside the host's Notepad window.
4. Type `Hello World 123`. Expect exactly that in Notepad, with capitals from Shift.
5. Press Enter, Backspace, Tab, the arrow keys, Home and End. Expect each to act in Notepad.
6. Type some text, press Ctrl+A, then Ctrl+C, click to a new line, press Ctrl+V. Expect the text to be pasted.
7. Hold down the letter `a` for two seconds. Expect repeated `a` on the host, like a normal keyboard.
8. Press Esc. Expect control ends (badge **Viewing**) and no Esc is typed on the host. Type some letters. Expect nothing appears on the host.
9. Take control again, hold Shift and press Esc. Expect control ends. Then type `a` on the host's own keyboard: it must be lower case (Shift is not stuck).

**Failure cases**

- **Window loses focus while holding:** take control, hold Shift, click another window on the viewer, then type on the host keyboard. Expect lower case, no stuck Shift.
- **Network drop while holding:** hold a letter through the viewer and unplug the cable. Expect the repeating to stop within a few seconds and the viewer to show "Reconnecting".
- **No helper:** move `apps/host/dist/helper/pilotpane-input.exe` to `.bak`, start with `pnpm --filter @pilotpane/host start`. Expect "Watching only" and typing does nothing on the host. Put the file back afterwards.

Not covered here: Alt+Tab, Win key and Ctrl+Alt+Del on the host (spec 014), non-US layouts on the viewer.
