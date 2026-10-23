# Spec 015: Quality presets

Status: Done | Package(s): protocol, viewer, docs | Depends on: 008, 012

Part of v0.4, "Quality and reliability". The presets 1080p, 720p and Low already exist (specs 005 and 012). This spec adds an Auto mode, remembers the viewer's last choice, and shows the active preset in the stats overlay.

## Goal

On a link that changes (Wi-Fi, Bluetooth), the viewer can pick "Auto" and the picture steps down when the link struggles and back up when it recovers. The viewer remembers the last choice, so nobody has to pick again after a refresh.

## Scope

- In: an "Auto" option in the quality select; a pure decision function that picks a preset from the `stats` the viewer already measures; the viewer remembers its choice per browser; a "quality" cell in the stats overlay showing the preset now in use; light tuning of the preset table only if the manual test shows a clear problem.
- Out: any change to the WebSocket protocol (Auto is viewer-side and sends the existing `set-quality`), a host-window quality control (needs a design), changing the 1080p/720p/Low numbers by default, internet use.

## Screens

- Quality select in the toolbar: canvas "Low-bandwidth preset", **Confirmed**. It gains one option, "Auto". No new component.
- Stats overlay: canvas "Viewer: stats overlay", **Confirmed**. It gains one more label/value pair, "quality", in the same mono style. Mention both in `DESIGN.md` (task 4). No other states. Auto shows no extra card.

## Protocol messages

None. Auto only sends `set-quality { preset }` with one of the three existing presets, so `PROTOCOL_VERSION` stays 2. The decision function lives in `packages/protocol` (`auto-quality.ts`) so it runs in Node tests and Chrome 109; it parses no network input.

## Design (SOLID)

- `packages/protocol/src/auto-quality.ts`: one job, `nextPreset(state, sample, now)`. A pure function. It takes the current preset, recent `StreamStats` samples and time, and returns the preset to use (or the same one). No timers, no DOM, no `node:` imports.
- Rules (constants at the top of the file, tested): step down one preset after about 6 s of loss at or above 3% or round trip over 250 ms; step up one preset only after about 30 s of loss under 0.5% and round trip under 120 ms. Frame rate is not used, because a still desktop sends few frames on a good link; at least 15 s between changes so it does not flap; never go below Low or above 1080p.
- Viewer `main.ts`: feeds each stats sample to `nextPreset` when mode is Auto and sends `set-quality` when the answer changes. The select shows "Auto" (stored value `auto`); the real preset is shown in the stats cell and comes from the host's `quality` message.
- Remembering: the viewer stores `auto` or a preset in safe storage (try/catch, works without storage). After pairing it sends `set-quality` for a stored preset, or starts Auto at 720p. A junk stored value is ignored.
- Nothing new is injected into the host; host code is unchanged.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `feat(protocol): add the auto quality decision` — `auto-quality.ts`, exported from the package index, tests: steps down on loss, on and on high round trip, ignores low fps; steps up only after the quiet period; holds the minimum gap; clamps at Low and 1080p; ignores a null round trip.
2. `feat(viewer): add Auto mode and remember the choice` — "Auto" option in `index.html`, Auto loop in `main.ts` fed by the stats timer, stored choice read after pairing, `quality` message updates the select only when not in Auto, off by default until chosen.
3. `feat(viewer): show the active preset in the stats overlay` — new "quality" cell, theme tokens only, fine in all four themes.
4. `docs: document auto quality` — `ARCHITECTURE.md` Video section, `DESIGN.md` (select option and stats cell), `ROADMAP.md` at Done in `/prepare-pr`.

## Done when

- [ ] `nextPreset` steps down on sustained loss or high round trip (and ignores low fps), and steps up only after the quiet period; it never changes more than once per 15 s and never leaves Low..1080p (unit tests).
- [ ] The quality select has Auto, 1080p, 720p, Low; choosing Auto sends no new message type and `PROTOCOL_VERSION` is unchanged.
- [ ] In Auto, throttling the link makes the preset drop on the live connection with no reconnect; restoring it makes the preset rise again.
- [ ] After a page refresh and pairing, the viewer is back on its last choice (Auto or a preset).
- [ ] The stats overlay shows the preset in use and updates when it changes.
- [ ] Choosing a fixed preset turns Auto off.
- [ ] The page still works with browser storage blocked (the choice is just not remembered).
- [ ] The viewer stays ES2020 and Chrome 109 safe; no `any`; no em dashes in copy.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test` and `pnpm scan` pass.

## Manual test guide

- **Host (Git Bash):** quit any running PilotPane first, then
  `cd /d/dream/pilotpane && pnpm build && PILOTPANE_LOG=debug pnpm start`
  Note the address and PIN.
- **Viewer (Windows 8 / Chrome 109):** open `http://<host address>:7420`, enter the PIN, wait for the picture.
  1. Open the toolbar. The quality select lists **Auto**, 1080p, 720p, Low. First visit: Auto is selected.
  2. Open **Stats**. A new **quality** value shows the preset in use (720p to start).
  3. Pick **1080p**. Quality shows 1080p and the picture sharpens. Pick **Low**: the hint card shows once.
  4. Refresh the page and pair again. The select shows Low (your last choice) and quality shows Low.
  5. Pick **Auto**, refresh, pair again. The select shows Auto.
  6. In Auto, make the link bad (move the viewer far from the router, or use the Bluetooth link from `docs/CONNECTIONS.md`). Within about 10 s of trouble the quality value drops one step (1080p to 720p to Low), with no reconnect and no more than one change per 15 s.
  7. Restore the link. After about 30 s of clean traffic the value rises one step, then another 30 s for the next.
  8. Pick a fixed preset while in Auto: Auto stops and the value stays where you set it.
- **Expected:** an idle desktop (nothing moving) does not push Auto down.
- **Failure cases:**
  - Open the page in a private window (storage blocked). Everything works; the choice is just not remembered.
  - In the browser console run `localStorage.setItem('pilotpane.quality','4k')` and refresh. The page starts in Auto and shows no error.
