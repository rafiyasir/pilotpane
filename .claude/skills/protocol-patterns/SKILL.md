---
name: protocol-patterns
description: How to add or change a network message in packages/protocol (type, parser, test, both sides). Use for any new message.
---

# Protocol patterns

Every network message goes through `packages/protocol`. Nothing else calls `JSON.parse` on network input.
The package runs in Node and Chrome 109: ES2020 target, no `node:` imports outside `*.test.ts`.

## Add a message, in this order

1. **Type** in `src/messages.ts`. Add it to the `ViewerMessage` or `HostMessage` union with a literal `type`:

   ```ts
   export interface SetQualityMessage {
     type: 'set-quality';
     preset: QualityPreset;
   }
   ```

2. **Parser** in `src/parse.ts`. Check the `type`, every field and its size or range. Return the typed value or
   `null` (or a reason); never throw. Messages are limited to `MAX_MESSAGE_BYTES`.

   ```ts
   case 'set-quality':
     return isQualityPreset(obj.preset) ? { type, preset: obj.preset } : null;
   ```

3. **Test** in `src/parse.test.ts` (`node:test`): one valid case, and invalid ones: wrong type, missing field,
   wrong field type, out-of-range value, oversized input.
4. **Host side**: handle it in `apps/host/src/main/session.ts` (and the controller if state changes). Messages from
   the viewer that fail to parse close that socket.
5. **Viewer side**: send it with a typed helper in `socket.ts`; handle host messages in the `switch` in `main.ts`
   with the exhaustive default.
6. **Docs**: add a row to the Messages table in `docs/ARCHITECTURE.md`.

## Rules

- Changing the shape of an existing message bumps `PROTOCOL_VERSION` in `constants.ts` and needs a
  `docs/DECISIONS.md` entry. The `hello` message tells an old viewer page about a mismatch.
- Secrets never go on the wire: the PIN travels only as `pinProof(nonce, pin)`.
- Input events (v0.2+) travel only over the WebRTC data channel, with their own parser here, never over the WebSocket.
- Internal host types (`EngineCommand`, `HostAction`, ...) live in `host-internal.ts`; they do not cross the network
  and need no wire parser, but renderer-to-main values are still checked in main.

## Check

`pnpm test` builds and runs the parser tests. Run it once before handing over.
