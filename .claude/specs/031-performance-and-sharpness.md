# Spec 031: Performance, lag over time and sharpness (DRAFT)

Status: Todo | Package(s): host, viewer, protocol | Depends on: 005, 015, ADR-016

Draft from real use: the lag grows the longer the app runs, gets worse when the host is busy, and scrolling looks like low-resolution internet video. Nothing here is measured yet, so task 1 comes first and decides the rest.

## Goal

The pointer and picture stay responsive during a long session and under host load, and text stays readable while scrolling.

## Findings so far (not yet measured)

- No timer or listener leak found in `engine.ts` or the viewer; the cause is probably load and heat, not a leak.
- ADR-016 made capture 1080p at 60 fps with `contentHint = motion`. If Chromium falls back to a software encoder, a busy host starves it and frames drop. Pointer lag follows, because the pointer is part of the video.
- `jitterBufferTarget` is Chrome 114+, so Chrome 109 only honours `playoutDelayHint`. A slow decoder can let the delay creep up.
- `motion` favours smooth frames over sharp ones, and the 1080p ceiling of 12 Mbps is low for a full-screen scroll.
- `autoStep` reacts to loss and round-trip time only, not to host CPU.

## Scope

- In: measure; adapt to host CPU; sharper scrolling; viewer catch-up when delay grows.
- Out: a native (non-Electron) host (would reverse ADR-001); the local cursor (spec 033); package size (spec 032).

## Tasks (to be made commit-sized when the spec is built)

1. Measure. Log, for a 30 minute session: encoder (hardware or software), `qualityLimitationReason`, fps, target bitrate and host CPU of the PilotPane processes. Write the numbers in the journal page. The engine already emits `debug-stats`.
2. Host-load adaptation: when the reason is `cpu`, step frame rate or preset down automatically and back up when it clears (extend `autoStep` or add a host-side step; no new message unless the viewer must know).
3. Stop the engine's capture while no viewer is paired, so an idle host costs almost nothing (check what happens today first).
4. Sharpness: try a higher 1080p ceiling, switching `contentHint` between `text` (still) and `motion` (moving), and matching the stream size to the viewer screen. Decide each by measurement, keep what helps.
5. Viewer: if buffered delay grows past a threshold, skip ahead to the live frame.
6. Update ADR-016 (or add an ADR) with the measured result.

## Done when (draft)

- [ ] A 30 minute session on the real laptops shows no growing lag, with numbers in the journal.
- [ ] With another heavy app running on the host, the pointer stays usable and the stats show the preset or fps stepping down instead of stalling.
- [ ] Idle host (no viewer) CPU is near zero.
- [ ] Scrolling text on the Windows 8 viewer is readable at 1080p on a good link.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` pass.

## Release

Planned for 0.4.3 (fixes, no new feature). Bump `PROTOCOL_VERSION` only if a message changes.
