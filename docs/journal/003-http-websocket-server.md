# SPEC 003: Own HTTP and WebSocket server

`v0.1` · `apps/host/src/main/net` · merged 2026-10-21 · progress 3 of 22 specs

**In one line:** the host can now serve the viewer page and speak WebSocket on private LAN addresses only, using nothing but Node built-ins.

## 1. What we built and where it lives

| Path | What it does | State |
|---|---|---|
| `apps/host/src/main/net/http-server.ts` | Static file server with security headers, `Host` and `Origin` checks, upgrade handling | Changed |
| `apps/host/src/main/net/ws.ts` | WebSocket frame parser and encoder, handshake, ping and close handling (RFC 6455) | Changed |
| `apps/host/src/main/net/lan.ts` | Finds private IPv4 addresses and guesses the connection type | Changed |
| `apps/host/src/main/net/ws.test.ts` | 8 tests: RFC example key, split frames, bad frames, path safety, wrong host, wrong origin, echo | Changed |
| `apps/host/src/main/log.ts` | `createLogger(scope)` so the host never uses bare `console.log` | Changed |
| `apps/host/package.json`, `tsconfig.json`, `tsconfig.renderer.json` | Host package and its two TypeScript projects | Changed |
| `packages/protocol` | Provides `WS_PATH` and the LAN address types | Uses it |

## 2. Decisions and the reasons

- **We chose** to write the HTTP server and WebSocket ourselves **instead of** `express` and `ws` **because** the dependency policy allows only the platform at runtime, and RFC 6455 is small enough to read end to end (ADR-002).
- **We chose** plain HTTP on the LAN **instead of** HTTPS only **because** old browsers show certificate warnings and nothing needs installing on the viewer. WebRTC encrypts the video anyway (ADR-004).
- **We chose** to bind only to private addresses and `127.0.0.1` **instead of** `0.0.0.0` **because** the screen of a PC must never be reachable from a public network.
- **We chose** to check `Host` and `Origin` on every request and upgrade **instead of** trusting any local client **because** it blocks DNS rebinding and other websites opening a socket to the host.

## 3. Where this sits in the journey

- **Built on:** spec 002 gave us `WS_PATH` and the message types that will travel over this socket.
- **Unlocks:** spec 004 will run pairing on top of `WebSocketConnection`, and spec 006 will be served by `http-server.ts`.

## 4. How it works

1. `lan.ts` lists the machine's IPv4 addresses and keeps only private ones (10.x, 172.16 to 172.31, 192.168.x, and link-local for direct cables). The list is refreshed every 3 seconds.
2. `http-server.ts` listens on those addresses and serves files from the viewer folder. Every request must carry a `Host` header that matches one of our own addresses.
3. An upgrade request goes through `acceptUpgrade`: method, headers, version 13, a 16-byte key, the `Host` and the `Origin` are all checked before the `101` answer is sent.
4. `WebSocketConnection` parses masked client frames, joins fragments, answers pings and closes on any protocol error.
5. A ping timer closes connections that stop answering, and an `end` handler closes connections whose peer just went away.

## 5. The code that matters

```ts
    socket.on('data', (chunk: Buffer) => this.onData(chunk));
    // The HTTP server keeps sockets half-open, so a peer that just goes away
    // only sends 'end'. Close our side too, or the viewer would look connected.
    socket.on('end', () => {
      socket.end();
      this.finish(CLOSE.GOING_AWAY, 'peer ended');
    });
    socket.on('close', () => this.finish(CLOSE.GOING_AWAY, 'socket closed'));
    socket.on('error', () => this.finish(CLOSE.GOING_AWAY, 'socket error'));
```

```ts
  // Only our own LAN addresses, and only pages we served ourselves.
  // This blocks DNS rebinding and other websites opening a socket to us.
  if (!check.allowedHosts.has(host)) return reject(socket, '421 Misdirected Request');
  if (h.origin !== `http://${host}`) return reject(socket, '403 Forbidden');
```

## 6. Concepts to go deeper

- **The WebSocket protocol**: handshake, framing, masking, close codes. [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455)
- **HTTP upgrade in Node**: how a server hands over the raw socket. [Node.js: http `upgrade` event](https://nodejs.org/api/http.html#event-upgrade_1)
- **Half-open sockets**: what `end` means and why `allowHalfOpen` matters. [Node.js: net `end` event](https://nodejs.org/api/net.html#event-end)
- **Private address ranges**: which IPv4 blocks never leave a LAN. [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918) and [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927)
- **Reading interfaces**: [Node.js: os.networkInterfaces](https://nodejs.org/api/os.html#osnetworkinterfaces)
- **The `Host` and `Origin` headers**: [MDN: Host](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Host) and [MDN: Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin)

## 7. Check yourself

1. Why must client frames be masked, and what does the server do with an unmasked one?
2. What does checking `Origin` protect against that checking `Host` does not?
3. Why is `192.168.137.x` treated as a hotspot address in `lan.ts`?

<details>
<summary>Answers</summary>

1. Masking is required by RFC 6455 for browser-to-server frames. Our parser rejects an unmasked client frame as a protocol error and closes the connection.
2. `Host` shows which address was typed. `Origin` shows which page opened the socket, so a malicious website in another tab is refused even if it knows our address.
3. That is the range Windows uses for its Mobile hotspot, so a viewer connected through the hotspot is likely to be reachable there.

</details>

## Bugs I hit

- **Symptom:** a viewer that went away still looked connected on the host.
- **Cause:** the HTTP server keeps sockets half-open, so a peer that simply disappeared only sent `end`. Nothing on our side closed the socket, so the connection never reported `close`.
- **Fix:** handle `'end'` in `WebSocketConnection`: end our side of the socket and finish the connection. See the first code block above.

## Commits

- `chore(host): add host package manifest and tsconfigs`
- `feat(host): add scoped logger`
- `feat(host): add private lan address discovery`
- `feat(host): add own http server with host and origin checks`
- `feat(host): add own websocket server (rfc 6455)`
- `test(host): add websocket server tests`

[Compare spec-002-done...spec-003-done](https://github.com/rafiyasir/pilotpane/compare/spec-002-done...spec-003-done)
