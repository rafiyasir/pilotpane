# Security notes

PilotPane gives someone your screen (and later your mouse and keyboard), so it is careful about who can connect. It is designed for **your own local network**, not for the internet.

## What protects you

| Measure                                                                                                                                 | Where                              |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Listens only on private IPv4 addresses (10/8, 172.16/12, 192.168/16, 169.254/16) and 127.0.0.1, one listener per address, never 0.0.0.0 | `net/lan.ts`, `net/http-server.ts` |
| `Host` header must be one of those addresses (blocks DNS rebinding)                                                                     | `http-server.ts`                   |
| WebSocket `Origin` must be the host's own page (blocks other websites in the viewer's browser)                                          | `net/ws.ts`                        |
| New random 6-digit PIN each start; "New PIN" any time                                                                                   | `pairing.ts`                       |
| The PIN never crosses the network: the viewer sends `SHA-256(nonce + PIN)` with a one-time nonce                                        | `protocol/pin.ts`                  |
| Constant-time comparison of proofs and tokens                                                                                           | `protocol/pin.ts`                  |
| 5 wrong PINs pause pairing for 60 s                                                                                                     | `pairing.ts`                       |
| One viewer at a time; others get "busy"                                                                                                 | `session.ts`                       |
| Resume tokens die when the PIN changes or the host restarts                                                                             | `pairing.ts`                       |
| Every message is size-limited and schema-checked; bad input closes the socket                                                           | `protocol/parse.ts`, `session.ts`  |
| Video is end-to-end encrypted by WebRTC (DTLS-SRTP), no STUN/TURN servers                                                               | `engine.ts`                        |
| Strict Content-Security-Policy, `nosniff`, `no-referrer`, `no-store`                                                                    | `http-server.ts`                   |
| Renderers sandboxed with context isolation; IPC senders checked                                                                         | `windows.ts`, `controller.ts`      |
| Updates: signed Ed25519 manifest, SHA-256 and size of the installer checked, only after a click                                         | `updater/`                         |

## Updates and the internet

PilotPane makes no internet requests on its own. The one exception is "Check for updates": after a click it fetches a small manifest from GitHub Pages, and after a second click ("Download") it fetches the installer the manifest names.

- The manifest must carry a valid Ed25519 signature from the key built into the app. A wrong, missing or edited signature stops everything before any download.
- The installer must match the signed SHA-256 and size, or it is deleted and not run.
- The private signing key is kept by the maintainer and is never in the repo.
- Viewers and pairing stay on the LAN only; this does not change that.

## The download page

The download website (GitHub Pages) makes one request: a script asks `api.github.com` for the release download counts, which GitHub already keeps. That request sends the visitor's IP address to GitHub, as any GitHub page does. Nothing else is requested, nothing is stored on a server we run, and the app itself collects nothing. If the request fails the page shows the number written at release time. The count means download requests, not installs.

## What plain HTTP means

The viewer page and the WebSocket use plain HTTP on your LAN. That is a deliberate trade-off (no certificate warnings on old browsers):

- Someone **on the same network** watching traffic can see the pairing messages, but not the PIN (only a one-time hash), and not the video (WebRTC encrypts it).
- Such a person could in theory tamper with the page in transit. On a home network or a direct cable this is unlikely; on a shared or public network, don't use PilotPane.
- From v0.2, mouse and keyboard input travel only over the encrypted WebRTC data channel, never over the WebSocket.
- v0.5 adds an optional HTTPS mode (self-signed certificate) for people who want it.

## Known limits

- A 6-digit PIN with lockout is fine against guessing on a LAN, not against an attacker who can wait for many hours. Use "New PIN" or pause sharing when you are done.
- Windows does not allow capturing or controlling the UAC secure desktop.
- Don't expose port 7420 to the internet (port forwarding). PilotPane is not designed for it.

## Reporting a problem

See [SECURITY.md](../SECURITY.md).
