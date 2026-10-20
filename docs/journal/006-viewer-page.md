# SPEC 006: Viewer page for Chrome 109

`v0.1` · `apps/viewer` · merged 2026-10-21 · progress 6 of 22 specs

**In one line:** an old laptop can open a web address, type a PIN and watch the host's screen, with nothing installed and a reconnect that keeps the last frame.

## 1. What we built and where it lives

| Path | What it does | State |
|---|---|---|
| `apps/viewer/src/socket.ts` | A thin WebSocket wrapper that only speaks our protocol | Changed |
| `apps/viewer/src/receiver.ts` | The WebRTC receiving side: answers the offer, shows the video, reads stats | Changed |
| `apps/viewer/src/main.ts` | Screens (PIN, connecting, stream), toolbar, fullscreen, themes, auto-reconnect | Changed |
| `apps/viewer/src/index.html` | Page markup | Changed |
| `apps/viewer/src/viewer.css`, `theme.css` | Layout and four themes written with CSS custom properties | Changed |
| `apps/viewer/package.json`, `tsconfig.json` | Viewer package and its ES2020 build | Changed |
| `packages/protocol` | Provides the parser, `pinProof` and the types | Uses it |
| `apps/host/src/main/net/http-server.ts` | Serves this folder to the viewer | Uses it |

## 2. Decisions and the reasons

- **We chose** plain HTTP with fallbacks **instead of** requiring HTTPS **because** old browsers show certificate warnings and nothing may be installed on the viewer. `window.isSecureContext` is checked before any secure-only API (ADR-004).
- **We chose** no bundler and no framework **instead of** a typical front-end stack **because** the page is small, Chrome 109 runs ES2020 as is, and the dependency policy forbids extra packages (ADR-002).
- **We chose** to close the peer connection but keep the `<video>` element **instead of** clearing the picture **because** the last frame stays on screen while the viewer reconnects.
- **We chose** to guard `localStorage` and `sessionStorage` with try and catch **instead of** assuming they work **because** storage can throw in private windows.

## 3. Where this sits in the journey

- **Built on:** spec 002 gave us the parser and `pinProof`, spec 004 the pairing rules and resume tokens, and spec 005 the offer to answer.
- **Unlocks:** spec 007 shows the same session on the host side, and spec 008 adds the numbers overlay on this page.

## 4. How it works

1. The page opens a WebSocket to `ws://` plus the address it was served from, and waits for `hello`.
2. The user types six digits. The page computes `pinProof(nonce, pin)` and sends `pair`. The PIN itself is never sent.
3. On success the page stores the token in `sessionStorage`, and the host sends an offer.
4. `Receiver.handleOffer` answers it, shows the stream in the video element and reports when the connection is up.
5. If the socket drops, the page keeps the last frame, shows "Reconnecting", and sends `resume` with the token. If the token no longer works, it asks for the PIN.

## 5. The code that matters

```ts
  connect(): void {
    this.dispose();
    const ws = new WebSocket(`ws://${location.host}${WS_PATH}`);
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.handlers.onOpen();
    };
    ws.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      const msg = parseHostMessage(e.data);
      if (msg) this.handlers.onMessage(msg);
      else console.warn('[pilotpane] ignored a bad message from the host');
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.handlers.onClose(opened);
    };
    this.ws = ws;
  }
```

## 6. Concepts to go deeper

- **WebSocket in the browser**: [MDN: WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- **Secure contexts**: which APIs disappear on plain HTTP. [MDN: Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
- **Receiving video**: [MDN: RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
- **Fullscreen**: [MDN: Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)
- **Themes**: [MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

## 7. Check yourself

1. Why does `dispose()` clear the handlers before closing the socket?
2. What does `onClose(wasOpen)` let the page tell apart?
3. Why does the page use `sessionStorage` for the resume token?

<details>
<summary>Answers</summary>

1. Otherwise `onclose` would fire and the page would start a reconnect that nobody asked for, for example after the user pressed Disconnect.
2. A connection that never opened (host unreachable) from one that opened and then dropped (network blip), which need different messages.
3. The token should live only as long as the tab. Closing the tab forgets it and the next visit asks for the PIN again.

</details>

## Bugs I hit

None worth a write-up for this spec.

## Commits

- `chore(viewer): add viewer package manifest and tsconfig`
- `feat(viewer): add websocket client with reconnect`
- `feat(viewer): add webrtc receiver`
- `feat(viewer): add page markup and styles`
- `feat(viewer): add pin entry and stream view logic`

[Compare spec-005-done...spec-006-done](https://github.com/rafiyasir/pilotpane/compare/spec-005-done...spec-006-done)
