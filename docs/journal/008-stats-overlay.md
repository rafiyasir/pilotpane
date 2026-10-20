# SPEC 008: Status and stats overlay

`v0.1` · `apps/viewer/src/main.ts` · merged 2026-10-21 · progress 8 of 22 specs

**In one line:** both sides can now see how the stream is doing: latency, fps, bitrate, size, codec and loss.

## 1. What we built and where it lives

| Path | What it does | State |
|---|---|---|
| `apps/viewer/src/receiver.ts` | `stats()` reads WebRTC statistics and turns byte counters into fps and kbps | Changed |
| `apps/viewer/src/main.ts` | Updates the overlay every second, remembers if it is shown, sends stats to the host every second tick | Changed |
| `packages/protocol/src/messages.ts` | `StreamStats` and the viewer `stats` message | Uses it |
| `packages/protocol/src/parse.ts` | Validates stats from the viewer before the host trusts them | Uses it |
| `apps/host/src/main/session.ts` | Accepts `stats` only from the active viewer | Uses it |
| `apps/host/src/renderer/host/host.ts` | Shows the numbers and the connection time in the host window | Uses it |

All the files were committed with specs 002 to 007. This spec adds no commits of its own, because the overlay was built as part of the viewer and host window work.

## 2. Decisions and the reasons

- **We chose** the browser's own `getStats()` **instead of** measuring on the host **because** the viewer sees what actually arrives: loss, decoded size and round-trip time (spec v0.1, AC-8).
- **We chose** to compute fps and bitrate from counter differences **instead of** trusting a single report **because** `bytesReceived` only grows, so the rate is the change divided by the time between two reads.
- **We chose** to send stats to the host every second tick **instead of** every tick **because** the host window does not need a one-second beat, and the control channel stays quiet.
- **We chose** to validate the stats message in the protocol parser **instead of** in the host window **because** all network input is parsed in one place (CLAUDE.md, code rules).

## 3. Where this sits in the journey

- **Built on:** spec 006 gave us the receiver and the toolbar, and spec 007 the host window to show the numbers.
- **Unlocks:** later quality presets (specs 011 and 014) need these numbers to show whether a change helped.

## 4. How it works

1. Every second the viewer calls `receiver.stats()`.
2. The receiver finds the inbound video report, the selected candidate pair and the codec report, and reads the counters.
3. It subtracts the previous reading to get fps and kbps, and uses the candidate pair's round-trip time as latency.
4. The page writes the six values into the overlay. The "Stats" button toggles it and the choice is remembered.
5. Every second tick the viewer also sends a `stats` message. The host checks the sender is the active viewer and shows the numbers in its window.

## 5. The code that matters

```ts
    let kbps = 0;
    let fps = num(inb.framesPerSecond);
    if (this.prev) {
      const secs = (now - this.prev.at) / 1000;
      if (secs > 0) {
        kbps = ((bytes - this.prev.bytes) * 8) / 1000 / secs;
        if (!fps) fps = (frames - this.prev.frames) / secs;
      }
    }
    this.prev = { bytes, frames, at: now };
```

```ts
function startStats(): void {
  stopStats();
  statsTick = 0;
  statsTimer = window.setInterval(async () => {
    const s = await receiver.stats().catch(() => null);
    if (!s) return;
    statsTick += 1;
    $('s-rtt').textContent = s.rttMs === null ? '-' : `${Math.round(s.rttMs)} ms`;
    $('s-fps').textContent = String(Math.round(s.fps));
    $('s-kbps').textContent = `${(s.kbps / 1000).toFixed(1)} Mbps`;
    $('s-size').textContent = s.width ? `${s.width}×${s.height}` : '-';
    $('s-codec').textContent = s.codec;
    $('s-loss').textContent = `${s.lossPct.toFixed(1)}%`;
    if (statsTick % 2 === 0) socket.send({ type: 'stats', stats: s });
  }, 1000);
}
```

## 6. Concepts to go deeper

- **Statistics API**: [MDN: RTCPeerConnection.getStats](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats)
- **Inbound video report**: [MDN: RTCInboundRtpStreamStats](https://developer.mozilla.org/en-US/docs/Web/API/RTCInboundRtpStreamStats)
- **Timing**: [MDN: Performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)

## 7. Check yourself

1. Why is the first reading after a connection missing a bitrate?
2. Why is latency `null` in some readings?
3. Why does the host reject `stats` from a viewer that is not active?

<details>
<summary>Answers</summary>

1. The bitrate is a difference between two readings. With no previous reading there is nothing to subtract, so it starts at 0 until the next tick.
2. The round-trip time lives on the selected candidate pair. Until a pair is selected, or if the browser does not report it, the value is missing and the page shows a dash.
3. A viewer that was refused as busy or has not paired should never change what the host shows, so the session ignores its messages.

</details>

## Bugs I hit

None worth a write-up for this spec.

## Commits

- (none: see the note in section 1)

[Compare spec-007-done...spec-008-done](https://github.com/rafiyasir/pilotpane/compare/spec-007-done...spec-008-done)
