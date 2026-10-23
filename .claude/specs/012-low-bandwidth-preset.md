# Spec 012: Low-bandwidth preset

Status: In progress | Package(s): protocol, host, viewer | Depends on: 005, 008

Part of v0.2, "Mouse and low bandwidth". Makes the Bluetooth fallback in `docs/CONNECTIONS.md` usable. Automatic adaptation is a later idea (see Out).

## Goal

On a very slow link (Bluetooth PAN, about 1 to 2 Mbps), the viewer can pick "Low" in the quality select and get a steady, smaller picture instead of a frozen one.

## Scope

- In: a third quality preset `low` (480p, 15 fps, 0.3 / 0.6 / 1 Mbps min / start / max); a per-preset frame rate cap; the "Low" option in the viewer select; the one-time hint card; the persisted host setting accepts `low`; docs say to use Low on Bluetooth.
- Out: automatic quality adaptation, internet use, new toolbar controls, changing 1080p or 720p, a host-window control for quality.

## Screens

- Low-bandwidth preset in the toolbar: canvas "Low-bandwidth preset", **Confirmed** (see `DESIGN.md`). The select gains one option; the hint card is shown once per browser.

## Protocol messages

`QUALITY_PRESETS` becomes `['1080p', '720p', 'low']`. This widens the `preset` field of `quality` (host to viewer) and `set-quality` (viewer to host); the parsers accept it through `isQualityPreset`. `QualitySpec` gains `maxFramerate`. `PROTOCOL_VERSION` goes to 2 and `DECISIONS.md` gets ADR-014, because an old peer would drop a `low` message. The viewer is always served by the host, so versions match in practice.

## Design (SOLID)

- No new modules. `constants.ts` stays the single table of presets; the engine, controller and settings already read it.
- Engine `applyQuality` uses `spec.maxFramerate` instead of the fixed 30.
- Viewer: the hint is a small function in the existing mouse-hint code path, with its "seen" flag in safe storage (try/catch, works without storage), like the mouse hint.
- Nothing new is injected; existing tests run under plain `node --test`.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `feat(protocol): add the low quality preset` — `constants.ts` (preset, spec, `maxFramerate` on all three), bump `PROTOCOL_VERSION`, parse tests for `low` in both messages and for a bad value.
2. `feat(host): apply per-preset frame rate` — `engine.ts` uses `spec.maxFramerate`; settings load/save accepts `low` and still falls back on junk (test in `settings` tests).
3. `feat(viewer): add the Low option and hint card` — option in `index.html`, hint card with "Got it", seen flag in safe storage, theme tokens only, all four themes.
4. `docs: document the low preset` — ADR-014, `CONNECTIONS.md` Bluetooth section says "choose Low", `ARCHITECTURE.md` presets list and message table, `ROADMAP.md` Done, `SECURITY_NOTES.md` untouched.

## Done when

- [ ] `isQualityPreset('low')` is true and `'480p'` is false; `parseViewerMessage` and `parseHostMessage` accept `low` and reject unknown presets.
- [ ] `QUALITY_SPECS` has `maxFramerate` for every preset (30, 30, 15).
- [ ] Picking Low in the viewer sets `maxBitrate` to 1 Mbps, the height to 480 and the frame rate to 15 on the live connection, with no reconnect (seen in the debug stats).
- [ ] The host saves `low` in settings and a restart with `low` stored still starts; a junk stored value falls back to 1080p.
- [ ] The hint card shows the first time Low is picked, not again after "Got it", and the page still works if storage is blocked.
- [ ] Switching back to 720p or 1080p restores the old caps.
- [ ] The viewer stays ES2020 and Chrome 109 safe; no `any`; no em dashes in copy.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test` and `pnpm scan` pass.

## Manual test guide

Filled in by `/build`.

- **Host (Git Bash):** exact commands.
- **Viewer (Windows 8 / Chrome 109 laptop):** what to open, click and look for.
- **Expected results** for each step.
- **Failure case** (at least one): what to break, and what should happen.
