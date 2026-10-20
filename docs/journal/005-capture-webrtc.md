# SPEC 005: Screen capture and WebRTC

`v0.1` · `apps/host/src/renderer/engine` · merged 2026-10-21 · progress 5 of 22 specs

**In one line:** the host can now capture the primary screen and send it to a paired viewer as live H.264 video over WebRTC.

## 1. What we built and where it lives

| Path | What it does | State |
|---|---|---|
| `apps/host/src/renderer/engine/engine.ts` | Hidden page that captures the screen, makes the WebRTC offer and applies quality presets | Changed |
| `apps/host/src/renderer/engine/engine.html` | The page that loads it | Changed |
| `apps/host/src/main/controller.ts` | Brain of the host: starts the servers, picks the screen, wires session, engine and windows | Changed |
| `apps/host/src/main/main.ts` | Electron entry: single-instance lock, switches, startup | Changed |
| `apps/host/src/main/windows.ts` | Creates sandboxed windows with the preload attached | Changed |
| `apps/host/src/main/preload.cts` | The small `window.pilotpane` bridge, the only way a renderer talks to main | Changed |
| `apps/host/src/main/app-protocol.ts` | Serves the host's own pages from `app://bundle/` instead of `file://` | Changed |
| `apps/host/src/main/settings.ts` | Saves the theme and quality choices to disk | Changed |
| `apps/host/src/main/session.ts` | Relays offer, answer and ICE between engine and viewer | Uses it |

## 2. Decisions and the reasons

- **We chose** Electron (`desktopCapturer` and Chromium's WebRTC) **instead of** a native capture plus ffmpeg pipeline **because** capture, hardware-friendly encoding and WebRTC come built in, and the project stays in TypeScript (ADR-001).
- **We chose** to switch off `WebRtcHideLocalIpsWithMdns` and use no STUN or TURN **instead of** Chromium's default `.local` names **because** on a direct cable or Bluetooth link there may be no working mDNS, and the viewer could never find the host (ADR-008).
- **We chose** to run capture in a hidden renderer **instead of** the main process **because** capture and WebRTC live in Chromium, not in Node.
- **We chose** `app://bundle` for the host's own windows **instead of** `file://` **because** a registered secure scheme allows ES modules and media capture and keeps those windows away from the LAN server.
- **We chose** `sandbox` and `contextIsolation` with a typed preload **instead of** Node access in renderers **because** a renderer should never be able to touch the system directly.

## 3. Where this sits in the journey

- **Built on:** spec 004 decides when a viewer becomes active, which is when capture starts.
- **Unlocks:** spec 006 will answer the offer in a browser, and spec 007 will show host state in windows through the same bridge.

## 4. How it works

1. When a viewer pairs, `controller.ts` asks `desktopCapturer` for the primary screen and tells the engine to `start` with the source id and the quality preset.
2. The engine captures at up to 1920 by 1080 and 30 fps, adds the video track as send-only and moves H.264 to the front of the codec list.
3. It creates an offer and sends it to main. Main sends it to the viewer over the WebSocket. ICE candidates follow the same road in both directions.
4. When the answer arrives, the engine applies the preset: scale down from the captured size and cap the bitrate (8 Mbps for 1080p, 4 Mbps for 720p).
5. While a viewer is watching, `powerSaveBlocker` keeps the display awake.

## 5. The code that matters

```ts
function preferH264(transceiver: RTCRtpTransceiver): void {
  const caps = RTCRtpSender.getCapabilities('video');
  if (!caps) return;
  const isH264 = (c: RTCRtpCodec) => c.mimeType.toLowerCase() === 'video/h264';
  const h264 = caps.codecs.filter(isH264);
  if (h264.length === 0) return;
  transceiver.setCodecPreferences([...h264, ...caps.codecs.filter((c) => !isH264(c))]);
}
```

```ts
  const peer = new RTCPeerConnection({ iceServers: [] }); // LAN only: no STUN, no TURN
  pc = peer;
  const transceiver = peer.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
  sender = transceiver.sender;
  preferH264(transceiver);

  peer.addEventListener('icecandidate', (e) => emit({ evt: 'ice', candidate: e.candidate ? toWire(e.candidate) : null }));
  peer.addEventListener('connectionstatechange', () => emit({ evt: 'connection', state: peer.connectionState }));

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  emit({ evt: 'offer', sdp: peer.localDescription?.sdp ?? offer.sdp ?? '' });
```

## 6. Concepts to go deeper

- **Desktop capture**: [Electron: desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer)
- **Context isolation and the bridge**: [Electron: contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)
- **Sandboxed renderers**: [Electron: Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- **Custom schemes**: [Electron: protocol](https://www.electronjs.org/docs/latest/api/protocol)
- **Peer connections**: [MDN: RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
- **Codec order**: [MDN: setCodecPreferences](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/setCodecPreferences)
- **Bitrate and scaling**: [MDN: RTCRtpSender.setParameters](https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/setParameters)
- **Offer and answer**: [RFC 8829: JSEP](https://www.rfc-editor.org/rfc/rfc8829) and [RFC 8445: ICE](https://www.rfc-editor.org/rfc/rfc8445)

## 7. Check yourself

1. Why does the engine queue commands and run them one at a time?
2. Why is `iceServers` an empty list?
3. What does `degradationPreference = 'maintain-resolution'` trade away, and why is that right for text?

<details>
<summary>Answers</summary>

1. Commands such as `start`, `answer` and `ice` depend on each other. Running them in order stops an `ice` command from arriving before the connection it belongs to is ready.
2. The two laptops share a LAN, so no STUN or TURN server is needed. Using none also keeps the project off the internet.
3. Under pressure the browser drops frames instead of making the picture blurrier. For code and documents, a sharp picture at lower fps reads better than a smooth blurry one.

</details>

## Bugs I hit

None worth a write-up for this spec.

## Commits

- `feat(host): add capture engine page with webrtc sender`
- `feat(host): add app protocol for renderer pages`
- `feat(host): add preload bridge`
- `feat(host): add settings store`
- `feat(host): add window manager`
- `feat(host): add controller wiring pairing, session and engine`
- `feat(host): add electron entry point`

[Compare spec-004-done...spec-005-done](https://github.com/rafiyasir/pilotpane/compare/spec-004-done...spec-005-done)
