# Spec 016: Auto-reconnect after host sleep

Status: Done | Package(s): host, viewer, docs | Depends on: 004, 005, 007, 008

Part of v0.4, "Quality and reliability". Resume tokens, the viewer's retry loop (1, 2, 4, 8, 10 s) and the host's network polling already exist. This spec closes the gaps that show up when the host sleeps or the link dies silently.

## Goal

If the host laptop sleeps, locks or loses its network for a while, the viewer notices quickly, keeps the last frame on screen, and picks the stream up again by itself when the host is back. Nobody retypes the PIN.

## Scope

- In: the viewer detects a dead link within a few seconds even when no close arrives (host asleep, cable pulled); the viewer retries at once when the browser comes back online or the tab becomes visible; the host ends the active viewer cleanly on suspend and re-checks addresses and listeners at once on resume; the viewer rebuilds the video when the socket is fine but the picture has stopped.
- Out: waking a sleeping host (Wake-on-LAN), keeping the host awake (spec 017), new quality logic, any protocol change, remembering the token across tab closes (it stays in session storage).

## Screens

- Viewer reconnecting: canvas "Viewer: reconnecting", **Confirmed**. Existing banner and text, reused as is. Only the attempt text may change.
- Viewer error and "Stopped trying" cards: existing, **Confirmed**. No new screens, no new tokens.

## Protocol messages

None. `PROTOCOL_VERSION` stays 2. Dead-link detection uses what the viewer already receives (the `stats` timer, `RTCPeerConnection` state and received frame count), not a new message.

## Design (SOLID)

- `packages/protocol/src/link-watch.ts` (so it runs under `node --test`; the viewer has no test runner): one job, decide if the link is dead. `LinkWatch.sample(now, transportBytes)` returns true after 8 s with no new bytes. It uses transport bytes (video, RTCP, ICE checks), not frames, so a still desktop is not flagged. No DOM, no timers.
- Viewer `main.ts`: calls `LinkWatch` from the existing stats timer; on `dead` it runs the same `onDrop` path as a socket close. Listens for `online` and `visibilitychange` and, while in `reconnecting`, calls `socket.connect()` right away instead of waiting out the delay (resets the attempt count).
- Host `platform/power.ts`: interface `PowerEvents { onSuspend(cb); onResume(cb) }`, with an Electron `powerMonitor` implementation beside it, injected into the controller from `main.ts`. A null implementation for tests.
- Host `controller.ts`: on suspend, `sessions.kick('host-stopped')` is NOT used (the viewer would stop trying); the controller just closes the active socket normally so the viewer sees a plain drop. On resume, calls `pollNetwork()` now (the 10 s poll can be late) and logs it. A stale socket from the same viewer is already replaced by `promote`.
- No change to pairing: the token stays valid until the PIN changes or the host restarts.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. `feat(viewer): detect a dead link` — `link-watch.ts` with tests (dead after 8 s without new transport bytes, alive when bytes move, a keep-alive trickle counts as alive, reset).
2. `feat(viewer): reconnect at once when the browser is back` — `online` and `visibilitychange` handlers, attempt count reset, wire `LinkWatch` into the stats timer.
3. `feat(host): add power events behind an interface` — `platform/power.ts` plus the Electron version, injected in `main.ts`, null version for tests.
4. `feat(host): close the viewer on suspend and re-check on resume` — controller wiring, log lines through `createLogger`, `ViewerSessions.dropActive` closes the socket without a `bye`. The controller imports Electron, so this wiring is checked by hand (see the guide).
5. `docs: document reconnect behaviour` — `ARCHITECTURE.md` data-flow step 10, `CONNECTIONS.md` note on sleep; `ROADMAP.md` goes to Done in `/prepare-pr`.

## Done when

- [ ] `LinkWatch` reports dead after the timeouts above, alive again when frames or stats resume, and does not flag an idle desktop (unit tests).
- [ ] With the host put to sleep and woken, the viewer shows the reconnecting banner with the last frame, then the stream returns with no PIN typed.
- [ ] Pulling the host's network cable for 20 s and putting it back also recovers by itself.
- [ ] A viewer tab that was hidden (or a laptop that slept) reconnects within about 2 s of coming back.
- [ ] On host resume, a new address appears in the host window without waiting for the 10 s poll.
- [ ] A wrong or expired token (new PIN while away) falls back to the PIN form, not a retry loop.
- [ ] A second viewer cannot take over during the gap: the same-machine replace rule still applies, other machines get "busy" only when the first is truly connected.
- [ ] No new network messages; LAN-only binding and `Host`/`Origin` checks untouched.
- [ ] The viewer stays ES2020 and Chrome 109 safe; no `any`; no em dashes in copy.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test` and `pnpm scan` pass.

## Manual test guide

- **Host (Git Bash):** quit any running PilotPane first, then
  `cd /d/dream/pilotpane && pnpm build && PILOTPANE_LOG=debug pnpm start`
  Note the address and PIN. Pair the viewer first.
- **Viewer (Windows 8 / Chrome 109):** open `http://<host address>:7420`, enter the PIN, wait for the picture.
  1. **Sleep:** on the host press Win, Power, Sleep. Within a second the viewer shows the reconnecting banner and keeps the last picture. Wake the host (key press). Within about 15 s the picture is live again with no PIN typed. Host log shows "going to sleep" and "woke up".
  2. **Cable pulled:** with the viewer on a cable, unplug it at the host for 20 s. After about 8 s the banner shows (no close arrives, this is the link watch; the console shows "the link went quiet"). Plug it back: the picture returns by itself.
  3. **Idle desktop:** leave the host desktop untouched for 2 minutes. The viewer must not drop.
  4. **Tab hidden:** in the viewer switch to another tab, unplug the host cable 30 s, plug it back, return to the tab. It reconnects within about 2 s of coming back.
- **Expected:** the stream returns each time without typing the PIN; the stats overlay and quality choice are back.
- **Failure cases:**
  - Sleep the host, click **New PIN** is not possible while asleep, so instead: disconnect the viewer's cable, press New PIN on the host, plug the cable back. The viewer shows the PIN form (not an endless retry).
  - Close the viewer tab while the host sleeps, then reopen the address after waking. It asks for the PIN (the token lives only in that tab).
  - Press **Stop trying** on the banner. It stops and does not reconnect when the browser goes online.
