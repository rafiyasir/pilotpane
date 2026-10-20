# Learning journal

One page per merged spec: what was built, the decisions behind it, how it works and where to learn more. Written for someone learning from the code, not as a changelog.

## Open it

- **From disk:** open `docs/journal/index.html` in a browser. It uses plain script tags, so `file://` works with no server.
- **On GitHub Pages:** in the repository settings choose Pages, "Deploy from a branch", branch `main`, folder `/docs`. The journal is then at `https://rafiyasir.github.io/pilotpane/journal/`. See [DEPLOYMENT.md](../DEPLOYMENT.md).

Fonts (Space Grotesk, IBM Plex Sans, JetBrains Mono) load from Google Fonts. Offline, the page falls back to system fonts.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell, brand, theme picker, picks the theme before first paint |
| `journal.css` | Layout and the four themes (Cockpit, Daylight, Midnight, Contrast), tokens copied from `apps/viewer/src/theme.css` |
| `journal.js` | Viewer: timeline, spec pages, routing by `#spec-NNN`, code highlighting |
| `roadmap.js` | Versions and spec titles for the timeline. Edit only when `docs/ROADMAP.md` changes |
| `specs/manifest.js` | The list of page files to load. Add a line per new page |
| `specs/NNN.js` | One page per merged spec |

A spec counts as done when it has a page. Nothing else stores status.

## Add a page

1. After a spec merges and is tagged `spec-NNN-done`, copy the newest `specs/NNN.js` to the new number and rewrite it.
2. Add `'NNN.js'` to `specs/manifest.js`.
3. If the roadmap changed, update `roadmap.js` to match `docs/ROADMAP.md`.
4. Run `node --check` on the files you touched and open `index.html` to look at the page.

Keep it honest: real bugs, real dead ends. Code excerpts must be copied from the real files. Drafts go in `private/` first (see [PUBLIC_PRIVATE.md](../PUBLIC_PRIVATE.md)).

## Page data shape

Each `specs/NNN.js` pushes one object onto `window.JOURNAL`. Prose fields accept `` `code` `` and `**bold**`.

```js
window.JOURNAL.push({
  number: '003',                 // three digits, matches roadmap.js
  title: 'Own HTTP and WebSocket server',
  version: 'v0.1',               // an id from roadmap.js
  mergedDate: '2026-10-21',      // ISO date
  technologies: ['Node http'],   // chips; a name that is also a Core concept is highlighted
  oneLine: 'One sentence on what this made possible.',

  what: {                        // section 1
    summary: 'A short paragraph.',
    partsTouched: [{ path: 'apps/host', note: 'What changed', changed: true }],
  },
  why: {                         // section 2
    decisions: [{ chose: '...', insteadOf: '...', reason: '...' }],
  },
  when: {                        // section 3
    dependsOn: [{ spec: '002', note: 'what it gave us' }],
    unlocks: [{ spec: '004', note: 'what builds on it' }],
  },
  how: {                         // section 4
    steps: [{ title: '...', explanation: '...' }],
  },
  code: [                        // first entry sits beside "How"; the rest get a "Code" section
    { file: 'apps/host/src/main/net/ws.ts', excerpt: '...', explanation: '...' },
  ],
  concepts: [                    // "Learn"; level is Core, Concept or Pattern
    {
      name: '...',
      level: 'Core',
      explanation: '...',
      resources: [{ title: '...', url: 'https://...' }],
    },
  ],
  bugs: [                        // optional "Bugs" section; leave out or [] if none
    { symptom: '...', cause: '...', fix: '...' },
  ],
  quiz: [{ question: '...', answer: '...' }],
  commits: ['feat(host): ...'],  // optional "Commits" section: subjects, plus a GitHub compare button
  commitsNote: '...',            // optional text shown in "Commits" (use when commits is empty)
});
```

Section numbers follow what is present: "Code", "Bugs" and "Commits" only appear, and take a number, when the page has them.

The Commits button links to `compare/spec-<previous>-done...spec-NNN-done` on GitHub (spec 001 links to `commits/spec-001-done`), so every spec needs its `spec-NNN-done` tag.
