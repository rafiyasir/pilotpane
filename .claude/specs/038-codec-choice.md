# Spec 038: Codec choice in the toolbar

Status: Todo | Package(s): protocol, viewer | Depends on: 037

## Goal

The person at the viewer can choose how the picture is encoded: leave it on Automatic, or pick the sharper or the lighter codec for their own machine.

## Principle

Same as spec 037: no codec of our own. The list only shows codecs the host offers and this browser can decode.

## Scope

- In: a Codec select in the viewer toolbar; the choice is remembered per browser; changing it reconnects the viewer so the new order takes effect; options come from the host's offer and the browser's decoding support.
- Out:
  - A host-side setting (a second design, later).
  - VP9, AV1, H.265 and the individual H.264 profiles in the list (untested or not a real choice).
  - Switching codec in the middle of a stream without reconnecting (would need a new offer from the host, a new message and a `PROTOCOL_VERSION` bump).

## Screens

Design gate. The inventory in `DESIGN.md` has no confirmed screen for this, so the first task is to get one designed. Proposal, built only from existing components and tokens:

| State        | Content                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codec select | One more select in the toolbar, next to the quality select, same style. Options in order: "Automatic", "VP8 (sharper text, uses more CPU)", "H.264 (lighter on old computers)". |
| Options      | Only codecs in the host's offer that this browser can decode. If only one is possible the select is disabled and shows it.                                                      |
| Changing it  | The viewer keeps its token, reconnects without asking for the PIN, and shows the existing "Reconnecting" state for a moment.                                                    |
| First time   | Optional card in the existing style with an `info` dot: "Picture style" and one line on what Automatic does, with "Got it". Shown once per browser.                             |

Status: Not designed. Stop and ask for the canvas screen before building.

## Protocol messages

None. The choice is applied in the viewer's answer SDP, as in spec 037. `PROTOCOL_VERSION` is unchanged.

## Design (SOLID)

- `codec-choice.ts` (spec 037) gains a user preference: `chooseCodec(offered, capabilities, userChoice)` where the choice is `auto`, `vp8` or `h264`. A forced choice that is not offered or not supported falls back to Automatic. Pure and tested.
- `apps/viewer/src/main.ts` owns the select and the stored value (safe storage, keyed like the quality choice); `receiver.ts` takes the choice as an argument and stays free of UI.
- The list of options is built from `offeredCodecs` and the capability probe, never hard-coded.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. Design: add the screen to the canvas and `DESIGN.md` inventory (Confirmed) before any UI code.
2. `chooseCodec` with a user choice, with tests (forced VP8, forced H.264, forced but unavailable, Auto).
3. Viewer: the select, the stored value, reconnect on change, disabled state.
4. Optional first-time card.
5. ADR-021 (or extend ADR-020) and the Video section of `docs/ARCHITECTURE.md`.
6. Manual test guide.

## Done when

- [ ] The select lists only codecs the host offers and the browser can decode.
- [ ] Picking VP8 or H.264 reconnects without the PIN, and Stats shows the chosen codec afterwards.
- [ ] The choice survives a page reload and applies on the next pairing.
- [ ] With a forced choice that the browser cannot decode, the viewer uses Automatic and says nothing alarming.
- [ ] All four themes show the select correctly (tokens only, focus ring visible).
- [ ] No new message; `PROTOCOL_VERSION` is unchanged.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` pass.

## Manual test guide

Filled in by `/build`.

- **Host (Git Bash):** `PILOTPANE_LOG=debug pnpm start`.
- **Viewer (Windows 8 / Chrome 109 laptop):** open the toolbar, change the Codec select, watch the reconnect, check **codec** in Stats.
- **Expected results** for each step.
- **Failure case:** pick a codec, then block reconnecting (unplug the cable) and confirm the viewer keeps the last frame and recovers.

## Release

Planned for 0.4.4 with spec 033.
