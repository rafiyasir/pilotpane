# SPEC 002: Typed protocol

`v0.1` · `packages/protocol` · merged 2026-10-21 · progress 2 of 22 specs

**In one line:** host and viewer now share one set of typed messages, one validator and one hand-written SHA-256, and the same code runs in Node and in Chrome 109.

## 1. What we built and where it lives

| Path | What it does | State |
|---|---|---|
| `packages/protocol/src/messages.ts` | Types for every message between host and viewer | Changed |
| `packages/protocol/src/parse.ts` | The only place network JSON is parsed and validated | Changed |
| `packages/protocol/src/sha256.ts` | SHA-256 written by hand (FIPS 180-4) | Changed |
| `packages/protocol/src/pin.ts` | `pinProof`, `constantTimeEqual`, `isPinShaped` | Changed |
| `packages/protocol/src/constants.ts` | Port, PIN length, lockout, quality presets, theme names | Changed |
| `packages/protocol/src/host-internal.ts` | Types for the host's own windows (state, actions, engine commands) | Changed |
| `packages/protocol/src/*.test.ts` | 9 tests: known vectors, parity with `node:crypto`, valid and invalid messages | Changed |
| `apps/host`, `apps/viewer` | Not written yet; they will import this package | Untouched |

## 2. Decisions and the reasons

- **We chose** a hand-written SHA-256 **instead of** `crypto.subtle` or a crypto library **because** the viewer is served over plain HTTP, which is not a secure context, so browsers hide `crypto.subtle` there. Our version runs the same in Node and Chrome 109 (ADR-007).
- **We chose** to send a nonce and a hash proof **instead of** sending the PIN **because** anyone sniffing the LAN then sees only a one-time hash (ADR-007).
- **We chose** one parse module for all network input **instead of** calling `JSON.parse` wherever a message arrives **because** a bad viewer can then never crash the host with an unexpected shape.
- **We chose** ES2020 output and no `node:` imports in the package **because** Chrome 109 has to run it as is, with no bundler.

## 3. Where this sits in the journey

- **Built on:** spec 001 gave us strict TypeScript, the workspace and the test command.
- **Unlocks:** spec 003 will send and receive these messages over the WebSocket, and spec 004 will check `pinProof` values.

## 4. How it works

1. `messages.ts` lists every message as a union with a `type` field, for example `hello`, `pair`, `pair-failed`, `offer`, `answer`, `ice`.
2. `parseViewerMessage` and `parseHostMessage` take a string, parse it once, check every field and return a typed message or `null`.
3. The host sends a random nonce in `hello`. The viewer answers with `pinProof(nonce, pin)`, a SHA-256 over a labelled string.
4. The host computes the same proof and compares it with `constantTimeEqual`, so timing does not reveal how many characters matched.
5. Tests compare our SHA-256 against `node:crypto` for every length from 0 to 300 and for a 1 MB input.

## 5. The code that matters

```ts
export function pinProof(nonce: string, pin: string): string {
  return sha256Hex(`pilotpane-pin:v1:${nonce}:${pin}`);
}

/** Compares two strings in time that does not depend on where they differ. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
```

```ts
  // Padding: data, 0x80, zeros, then the bit length as a 64-bit big-endian number.
  const len = data.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(len / 0x20000000));
  view.setUint32(total - 4, (len * 8) >>> 0);
```

## 6. Concepts to go deeper

- **SHA-256**: the algorithm and its padding rules. [RFC 6234: US Secure Hash Algorithms](https://www.rfc-editor.org/rfc/rfc6234)
- **Secure contexts**: why `crypto.subtle` is missing on plain HTTP. [MDN: Secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
- **SubtleCrypto**: what we would use on HTTPS. [MDN: SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- **Typed arrays**: `Uint32Array` gives the 32-bit wraparound maths SHA-256 needs. [MDN: Uint32Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array)

## 7. Check yourself

1. Why does the protocol package avoid `node:` imports outside tests?
2. Why does `constantTimeEqual` loop over the whole string instead of returning at the first difference?
3. If an attacker records one `pair` message, why can they not reuse it later?

<details>
<summary>Answers</summary>

1. The viewer runs the same code in Chrome 109, which has no `node:` modules and no bundler to replace them.
2. Returning early would take slightly less time for a wrong guess that differs near the start, which leaks information about the secret.
3. The proof covers a nonce that the host makes new for every connection, so an old proof never matches a new nonce.

</details>

## Bugs I hit

None worth a write-up for this spec.

## Commits

- `chore(protocol): add package manifest and tsconfig`
- `feat(protocol): add message types and constants`
- `feat(protocol): add own sha256 and pin proof`
- `feat(protocol): add message parsing and validation`
- `test(protocol): add sha256 and parse tests`

[Compare spec-001-done...spec-002-done](https://github.com/rafiyasir/pilotpane/compare/spec-001-done...spec-002-done)
