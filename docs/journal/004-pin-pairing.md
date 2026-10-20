# SPEC 004: PIN pairing

`v0.1` · `apps/host/src/main/pairing.ts` · merged 2026-10-21 · progress 4 of 22 specs

**In one line:** a viewer can now prove it knows the PIN without sending it, wrong guesses are limited, and one viewer at a time can watch.

## 1. What we built and where it lives

| Path | What it does | State |
|---|---|---|
| `apps/host/src/main/pairing.ts` | Makes the PIN and nonces, checks proofs, counts wrong tries, issues resume tokens | Changed |
| `apps/host/src/main/session.ts` | Talks to viewers over WebSocket: `hello`, pairing, resume, busy, relaying signaling | Changed |
| `apps/host/src/main/pairing.test.ts` | 8 tests: PIN shape, proof, lockout, new PIN, address and browser helpers | Changed |
| `apps/host/src/main/net/ws.ts` | Carries the messages | Uses it |
| `packages/protocol` | Provides `pinProof`, `constantTimeEqual` and the message types | Uses it |

## 2. Decisions and the reasons

- **We chose** a nonce and a hash proof **instead of** sending the PIN **because** the PIN never has to travel on the network (ADR-007).
- **We chose** to pause pairing for 60 seconds after 5 wrong tries **instead of** unlimited tries **because** a 6-digit PIN has only a million values, and the pause makes guessing impractical (ADR-007).
- **We chose** resume tokens **instead of** asking for the PIN after every network drop **because** the viewer can reconnect on its own. A new PIN forgets every token.
- **We chose** a single active viewer **instead of** several **because** each viewer needs its own encode, which hurts slow links (ADR-005).
- **We chose** `Pairing` and `Session` with no Electron imports **instead of** mixing them into the Electron code **because** they can then be tested in plain Node.

## 3. Where this sits in the journey

- **Built on:** spec 002 gave us `pinProof`, and spec 003 gave us the WebSocket connection.
- **Unlocks:** spec 005 will start the capture when a viewer is promoted to active, and spec 006 will answer `hello` with the PIN screen.

## 4. How it works

1. A new connection receives `hello` with a fresh nonce and the protocol version.
2. The viewer sends `pair` with `pinProof(nonce, pin)`. The host computes the same value and compares in constant time.
3. A match gives the viewer a random token and promotes it to the active viewer. A second viewer gets `busy` and is closed.
4. A mismatch returns `pair-failed` with the reason and how many tries are left. The fifth wrong try starts the 60-second pause.
5. After a network drop the viewer sends `resume` with its token and skips the PIN. `newPin()` clears all tokens, so a new PIN ends every old pairing.

## 5. The code that matters

```ts
    if (constantTimeEqual(pinProof(nonce, this.currentPin), proof.toLowerCase())) {
      this.wrongAttempts = 0;
      const token = randomBytes(24).toString('base64url');
      this.tokens.add(token);
      return { ok: true, token };
    }

    this.wrongAttempts += 1;
    if (this.wrongAttempts >= MAX_PIN_ATTEMPTS) {
      this.lockedUntilMs = now + PIN_LOCK_SECONDS * 1000;
      return { ok: false, reason: 'locked', attemptsLeft: 0, retryAfterSec: PIN_LOCK_SECONDS };
    }
    return { ok: false, reason: 'wrong-pin', attemptsLeft: MAX_PIN_ATTEMPTS - this.wrongAttempts, retryAfterSec: 0 };
```

```ts
            this.send(conn, {
              type: 'pair-failed',
              reason: result.reason,
              attemptsLeft: result.attemptsLeft,
              retryAfterSec: result.retryAfterSec
            });
```

## 6. Concepts to go deeper

- **Random integers**: why `randomInt` is used, not `Math.random`. [Node.js: crypto.randomInt](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback)
- **Random bytes**: where nonces and tokens come from. [Node.js: crypto.randomBytes](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback)
- **Timing-safe comparison**: the built-in version of what `constantTimeEqual` does. [Node.js: crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
- **Close codes**: how `busy` ends the connection politely. [RFC 6455, section 7.4](https://www.rfc-editor.org/rfc/rfc6455#section-7.4)

## 7. Check yourself

1. Why does `verify` clear the lock the first time it is called after the pause ends?
2. What happens to a viewer's token when the host presses "New PIN"?
3. Why is the `Pairing` class given a `now` function instead of calling `Date.now()` directly?

<details>
<summary>Answers</summary>

1. Otherwise the old wrong-attempt count would survive the pause and the viewer would be locked again after one wrong try.
2. All tokens are cleared, so a resume with the old token fails with `bad-token` and the viewer has to type the new PIN.
3. Tests can pass a fake clock and check the 60-second lock and unlock without waiting.

</details>

## Bugs I hit

- **Symptom:** the `pair-failed` message sent to the viewer had an extra `ok: false` field.
- **Cause:** the internal result of `Pairing.verify` has an `ok` field, and it leaked into the message that went to the viewer.
- **Fix:** send explicit fields (`reason`, `attemptsLeft`, `retryAfterSec`), as in the second code block above, so only what the protocol defines goes out.

## Commits

- `feat(host): add pin pairing with lockout and resume tokens`
- `feat(host): add single viewer session`
- `test(host): add pairing tests`

[Compare spec-003-done...spec-004-done](https://github.com/rafiyasir/pilotpane/compare/spec-003-done...spec-004-done)
