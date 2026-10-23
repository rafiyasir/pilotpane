# Spec 029: Smooth touchpad scroll

Status: In progress | Package(s): protocol, host, viewer | Depends on: 011, fix/wheel-notches

Part of v0.4, "Quality and reliability". Spec number 029 because numbers are permanent. Needs the `fix/wheel-notches` PR (the `WheelAccumulator`) merged into `dev` first. A touchpad swipe on the viewer scrolls the host in whole notches (about 3 lines each), so it is steady but steppy.

## Goal

Two-finger scrolling on a viewer touchpad glides on the host the way it does on the viewer's own pages: small moves scroll a little, fast swipes scroll a lot, and nothing jumps.

## Scope

- In: send wheel movement in finer units (1/120 of a notch, the Windows `WHEEL_DELTA` step) instead of whole notches; the viewer converts pixels, lines and pages to those units and sends at most one wheel message per animation frame; the helper and `InputCommand` accept the finer units; tests and docs.
- Out: kinetic or momentum scrolling made up by us (the touchpad and browser already send their own), scroll speed settings, changing mouse buttons or moves, horizontal-only tuning beyond using the same units.

## Screens

No screens.

## Protocol messages

`mouse-wheel { dx, dy }` keeps its name and fields but the unit changes from notches to **wheel units** (120 units = one notch, positive `dy` scrolls up, positive `dx` scrolls right). The limit goes from 100 notches to `WHEEL_MAX` = 12000 units per message. This is a change in meaning an old peer would misread (it would scroll 120 times too far), so `PROTOCOL_VERSION` goes to 3 and `DECISIONS.md` gets ADR-016. The viewer is served by the host, so versions match in practice.

## Design (SOLID)

- `pointer-map.ts`: `WheelAccumulator` is replaced by `wheelToUnits(delta, mode)` (pure: 100 px, 3 lines or 1 page-step = 120 units) plus a small sum per frame. No leftover fraction is needed because units are integers; round to the nearest unit and carry the rounding remainder so slow swipes do not lose movement.
- `pointer.ts` (viewer): adds up wheel events during one animation frame and sends one message, the same pattern as `queue` for moves. Sends nothing when the sum is 0.
- `input-command.ts` (host): `WHEEL_MAX` and the `W` command use units. `input-bridge.ts` still never drops wheel messages.
- Helper (`apps/host/helper`, C#): the `W` command takes units and passes them straight to `SendInput` (drop the `* WHEEL_DELTA` multiply). Update `PROTOCOL.md`. The helper is built by `pnpm build`.
- Nothing new is injected; protocol, bridge and command tests run under plain `node --test`.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `feat(protocol): send wheel movement in 1/120 notch units` — `input.ts` (`WHEEL_MAX`, parser), `pointer-map.ts` (`wheelToUnits`, remove the accumulator), bump `PROTOCOL_VERSION` to 3, tests: mouse click = 120, 4 px = about 5 units, lines and pages, rounding carry, direction flip, limit and bad values rejected.
2. `feat(host): pass fine wheel units to the helper` — `input-command.ts`, `input-bridge.ts` tests, helper `W` command and `PROTOCOL.md`.
3. `feat(viewer): send one wheel message per frame` — `pointer.ts` sums events per animation frame, resets on release.
4. `docs: add ADR-016 and update the wheel notes` — `DECISIONS.md`, `ARCHITECTURE.md` (message table and input paragraph), `ROADMAP.md` Done in `/prepare-pr`.

## Done when

- [ ] `parseInputMessage` accepts `mouse-wheel` units up to 12000 in both directions and rejects 12001, fractions and non-numbers.
- [ ] A mouse wheel click still scrolls the host one notch (120 units); a 4 px touchpad event scrolls about one thirtieth of a notch, not a whole one.
- [ ] A slow two-finger swipe moves the host page in small steps and a fast swipe moves it far, with no jump to the top or bottom.
- [ ] At most one `mouse-wheel` message is sent per animation frame; none when the sum is 0.
- [ ] The helper accepts `W <dx> <dy>` in units and rejects values beyond the limit; the old whole-notch scale is gone from code and docs.
- [ ] `PROTOCOL_VERSION` is 3 and ADR-016 explains why.
- [ ] The viewer stays ES2020 and Chrome 109 safe; no `any`; no em dashes.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test` and `pnpm scan` pass.

## Manual test guide

Filled in by `/build`.

- **Host (Git Bash):** exact commands.
- **Viewer (Windows 8 / Chrome 109 laptop):** what to open, click and look for.
- **Expected results** for each step.
- **Failure case** (at least one): what to break, and what should happen.
