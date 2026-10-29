# Spec 031: Performance, lag over time and sharpness

Status: Done | Package(s): protocol (internal types), host | Depends on: 005, 015, ADR-016

## Goal

The pointer and picture stay responsive during a long session and while the host is busy, and text stays readable while scrolling.

Real use showed three things: lag grows the longer the app runs, it gets worse when the host is busy, and scrolling looked like low-resolution internet video. Measuring came first (ADR-018, ADR-019); its numbers decided what was built.

## Findings (measured on two modern laptops on one phone hotspot)

- The host used the AMD hardware H.264 encoder and was never limited by CPU. The viewer decoded in hardware (1 to 3 ms per frame), lost 0.02% of packets, and the round trip was 8 ms. Neither the network nor the decoder was the problem.
- A full-screen scroll was smeared for seconds and sharp again when it stopped. The picture size stayed 1920×1080, so the encoder was spending too few bits: it used 6 to 7 Mbps of an 11 Mbps target. A higher bitrate ceiling and the other capture path changed nothing.
- Software VP9 was sharp but choppy and laggy at 1080p. Software VP8 with `contentHint = detail` was smooth: 30 to 56 fps while scrolling (hardware H.264 peaked near 33), about 7% host CPU on average, never limited by CPU (ADR-019).
- Capture starts only when a viewer pairs and stops when it leaves (`controller.ts`), so an idle host runs no capture.
- Lag after minutes of idle with a deliberately heavy app running (94% RAM) is most likely Windows paging idle processes back in. Not a PilotPane fault, and not fixed here.

## Scope

- In: measure; adapt to host CPU; sharper scrolling (codec order and capture hint).
- Out: a native (non-Electron) host (would reverse ADR-001); the local cursor (spec 033); package size (spec 032); switching `contentHint` by guessing whether the screen is still (ADR-019); a user setting for the codec (needs a designed settings screen).

## Screens

No screens. Existing stats overlay and host window are unchanged.

## Protocol messages

None on the network. `EngineEvent` `debug-stats` (internal, `host-internal.ts`) gains `encoderImplementation`, `powerEfficientEncoder` and `cpuLimitedSec`; `EngineCommand` gains `load-level`. `PROTOCOL_VERSION` is unchanged.

## Design (SOLID)

- `host-load.ts` (main process, no Electron imports): `HostLoadGovernor` turns `qualityLimitationReason` samples into a load level with hysteresis (down after about 5 s of `cpu`, up after 30 s without it, at most one change per 15 s). Injected clock, tested under `node --test`.
- `controller.ts` feeds it from `debug-stats` and sends `load-level` to the engine.
- `engine.ts` stays the only place that reads `RTCPeerConnection` stats and applies the ceiling; `preferCodecs` holds the codec order.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. **Measure.** `debug-stats` carries the encoder, a hardware flag and CPU-limited seconds; the debug log also prints load level and free RAM.
2. **Host-load governor.** `host-load.ts` with unit tests, the internal `load-level` command, and the ceiling in the engine.
3. **Sharper scrolling.** `contentHint = detail` and codec order VP8, then H.264 (`preferCodecs`).
4. **Docs.** ADR-018, ADR-019, ARCHITECTURE Video section.

## Done when

- [ ] No growing lag across a 30 minute session on the real laptops, with numbers in the journal page.
- [ ] Scrolling is sharp and smooth on the modern viewer (viewer-side screenshot mid-scroll shows no smearing).
- [ ] Scrolling is sharp and smooth on the Windows 8 / Chrome 109 viewer (it decodes VP8 in software). If not, the codec order changes before merge.
- [ ] Host CPU while scrolling stays low (measured about 7% on average) and the log never shows `limited by cpu` on the test laptop.
- [x] The governor has unit tests for step down, hold, step up, and the once-per-interval limit.
- [x] Idle host (no viewer paired) runs no capture (checked in code).
- [x] No new network message; `PROTOCOL_VERSION` is unchanged.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` pass.

## Manual test guide

- **Host (Git Bash):** quit PilotPane fully (tray, Quit), then `PILOTPANE_LOG=debug pnpm start`. Note the PIN and the address.
- **Viewer:** open `http://<host address>:7420`, type the PIN, pick 1080p, click the screen, open Stats.

1. **Codec and encoder.** In Stats, **codec** says VP8. In the host log, `encoder libvpx`, and each `send:` line ends with `free RAM N MB`.
2. **Scroll sharpness (modern viewer).** Scroll a long text page hard for 10 seconds. Take a viewer-side screenshot (Win+Shift+S) mid-scroll and another 3 seconds after you stop. Text should be readable in both, with no smeared blocks. Stats should show up to 30 or more fps.
3. **Typing and pointer.** Type for a minute after scrolling. Typing should feel immediate.
4. **Host CPU.** In Task Manager (Details), watch the Electron processes while scrolling. Expect about 5 to 15%.
5. **Busy host.** Start something heavy on the host. If the log shows `limited by cpu`, within about 10 to 20 s it prints `host is busy: stream load level 1` (then 2) and fps or size in Stats drop. After the load stops, each level returns after about 30 s.
6. **Windows 8 / Chrome 109 viewer.** Repeat steps 2 and 3. Check Stats fps stays reasonable and scrolling is not choppy. If it is, tell the maintainer: VP8 is decoded in software there.
7. **Idle host.** Before pairing, and after the viewer leaves, the PilotPane processes sit near 0% CPU.

- **Failure case:** with the viewer paired, unplug the viewer's cable for 20 s. The host must not crash, the log must show the viewer gone, and the next pairing starts at load level 0. A wrong PIN is refused and no capture starts.

## Release

Planned for 0.4.3 with specs 032, 034 and 035 (fixes, no new feature). The codec change is visible to every user, so call it out in the changelog.
