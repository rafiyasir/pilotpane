# Spec 037: Automatic codec

Status: Done | Package(s): protocol, viewer | Depends on: 005, 031 (ADR-019)

## Goal

The viewer picks the best video codec for its own machine, so the VP8 default from spec 031 cannot make an old viewer (Windows 8, Chrome 109) choppy.

## Principle

PilotPane never ships or writes a codec. It only chooses the order among the codecs WebRTC already negotiates: software ones bundled with Electron and the browser, and hardware ones provided by the OS and GPU driver. This goes into ADR-020.

## Scope

- In: read the codecs in the host's offer; ask the browser whether 1080p at 30 fps decodes smoothly for each candidate; reorder the viewer's codec preferences before it answers; a safe fallback when the browser cannot say.
- Out:
  - Our own codecs, WebCodecs (secure context only, and the viewer is plain HTTP), WebAssembly decoders.
  - A user choice in the UI (spec 038).
  - VP9, AV1 and H.265 as preferred codecs (untested; VP9 was choppy at 1080p). They stay at the end of the list so negotiation still works.
  - Any change on the host: it keeps offering VP8 first, then H.264 (ADR-019).

## Screens

No screens. The stats overlay already shows the codec in use.

## Protocol messages

None. The decision is local to the viewer and rides on the existing `answer` SDP. `PROTOCOL_VERSION` is unchanged.

## Design (SOLID)

- `packages/protocol/src/sdp.ts`: `offeredCodecs(sdp)` returns the codec families in an offer (`vp8`, `h264`, ...), ignoring `rtx`, `red` and `ulpfec`. Pure.
- `packages/protocol/src/codec-choice.ts` (new): `chooseCodec(offered, capabilities)` returns the preferred order. Pure, no browser types, runs under `node --test`.
  - VP8 first when it is offered and reported smooth.
  - Otherwise H.264 first when offered and supported.
  - Everything else after, in the offer's own order.
  - Unknown capability (null) counts as "not known smooth", so H.264 goes first.
- `apps/viewer/src/receiver.ts`: asks `navigator.mediaCapabilities.decodingInfo({ type: 'webrtc', ... })` through a small injected probe with a timeout of about 1 s, applies the order with `setCodecPreferences` on the video transceiver before `createAnswer`, and logs the choice.
- The probe is injected so the viewer logic can be tested without a browser. Chrome 109 only APIs; every call is guarded.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `offeredCodecs` in `sdp.ts` with tests (VP8 and H.264 offers, `rtx` and `red` ignored, audio ignored).
2. `codec-choice.ts` with tests: VP8 smooth, VP8 not smooth, VP8 missing from the offer, capability unknown, API error.
3. `receiver.ts`: probe with timeout, apply the order, log the result.
4. ADR-020 (the principle and this decision) and the Video section of `docs/ARCHITECTURE.md`.
5. Manual test guide.

## Done when

- [ ] On the modern viewer the codec shown in Stats is VP8 and scrolling stays sharp.
- [ ] On the Windows 8 / Chrome 109 viewer the picture is smooth, with VP8 only if the browser reports it smooth, otherwise H.264.
- [ ] With `navigator.mediaCapabilities` unavailable or slow, the viewer falls back to H.264 first and still plays.
- [ ] `chooseCodec` and `offeredCodecs` have unit tests and pass under `node --test`.
- [ ] No new message; `PROTOCOL_VERSION` is unchanged.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` pass.

## Manual test guide

Filled in by `/build`. Before building, run this once on the Windows 8 laptop, on the viewer page, in the F12 console, and keep the output:

```js
navigator.mediaCapabilities
  .decodingInfo({
    type: 'webrtc',
    video: { contentType: 'video/VP8', width: 1920, height: 1080, framerate: 30, bitrate: 8000000 }
  })
  .then((r) => console.log('VP8', JSON.stringify(r)));
navigator.mediaCapabilities
  .decodingInfo({
    type: 'webrtc',
    video: {
      contentType: 'video/H264;profile-level-id=42e01f',
      width: 1920,
      height: 1080,
      framerate: 30,
      bitrate: 8000000
    }
  })
  .then((r) => console.log('H264', JSON.stringify(r)));
```

If it errors, Chrome 109 has no usable answer and the fallback (H.264 first) is what will run there.

- **Host (Git Bash):** quit any running PilotPane, then `pnpm build && PILOTPANE_LOG=debug pnpm start`.
- **Viewer (Windows 8 / Chrome 109 laptop):** open the host address, press F12 and open Console, then type the PIN. The console prints `codec order vp8, h264` or `codec order h264, vp8`. Open Stats and read **codec**. Scroll a long page for a minute, then type in a text box.
- **Viewer (modern laptop):** the same steps.
- **Expected results:**
  - Modern viewer: console `codec order vp8, h264`, Stats codec VP8, scrolling sharp.
  - Windows 8 viewer: Stats codec matches the first codec in the console line. It is VP8 only if your saved `decodingInfo` output said `smooth: true` for VP8, otherwise H.264. The picture is smooth either way.
  - If `decodingInfo` errored on Chrome 109 earlier, the console line starts with `h264`.
- **Failure case:** on the viewer, before pairing, run `Object.defineProperty(navigator, 'mediaCapabilities', { value: undefined })` in the console, then pair. Expected: `codec order h264, vp8`, Stats codec H.264, and the picture plays.

## Release

Planned for 0.4.3 with spec 031, because it protects old viewers from 031's VP8 default.
