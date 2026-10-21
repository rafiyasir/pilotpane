---
name: viewer-patterns
description: Shapes for the PilotPane viewer page (ES2020, Chrome 109, plain HTTP, screens and state, safe storage). Use when editing apps/viewer.
---

# Viewer patterns

## Hard limits

- ES2020 output, no bundler, no framework. Modules load directly; the protocol is served at `/protocol/`.
- Only browser APIs Chrome 109 has. When unsure, check the MDN compatibility table before using an API.
- The page is plain HTTP, so it is not a secure context. Check before using `crypto.subtle`, the async Clipboard API
  or Keyboard Lock, and keep a fallback.

```ts
if (window.isSecureContext && navigator.clipboard) {
  await navigator.clipboard.writeText(text);
} else {
  legacyCopy(text); // hidden textarea + document.execCommand('copy')
}
```

## Screens and state

One state at a time: connecting, PIN entry, locked, busy, streaming, reconnecting, error. Every state is handled.
A status screen is one call with plain English copy that never blames the user:

```ts
showCard({ label: 'Connecting', title: 'Connecting to the host', spinner: true });
showCard({ label: 'Busy', title: 'Someone else is connected', text: 'Try again when they are done.' });
```

Keep state in module variables in `main.ts`; a message handler switches on `message.type` and ends with an
exhaustive default. While reconnecting, keep the last video frame on screen.

## Storage

`localStorage` and `sessionStorage` can throw (private mode, blocked data). Always wrap them:

```ts
function read(area: 'local' | 'session', key: string): string | null {
  try {
    return (area === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
```

Store only convenience values (theme, stats shown). The PIN is never stored; the resume token lives in
`sessionStorage`.

## Styling

Colours, fonts and radii come from `theme.css` tokens (`var(--accent)`). No hard-coded colours in components.
Add a token to all four themes (Cockpit, Daylight, Midnight, Contrast) or not at all, and update `design/tokens.json`.

## Network

Messages are parsed with `parseHostMessage` from `/protocol/` and never with a bare `JSON.parse`.
Reconnect with backoff (1, 2, 4, 8, 10 s) and `resume { token }`.
