# Contributing

Thanks for your interest! PilotPane is small on purpose, so please read [CLAUDE.md](CLAUDE.md) first: it holds the coding rules and the **dependency policy** (no third-party runtime packages for features).

## Setup

Node.js 22.12+, pnpm 10, Git, Windows 10/11 for the host.

```bash
pnpm install
pnpm test
pnpm start
```

## How work happens

1. Open an issue describing the problem or idea.
2. For anything bigger than a fix, a short spec in `docs/specs/` comes first, with acceptance criteria.
3. Branch from `dev` (`feat/...`, `fix/...`, `docs/...`), make small focused commits, keep `pnpm test` green.
4. Open a PR against `dev` with: what changed, why, and **manual test steps** (what to run, what to open on the viewer, what you should see).
5. Test on an old browser if you touched the viewer (Chrome 109 is the baseline).

`main` only receives release merges from `dev`.

## Style

TypeScript strict, small modules, typed protocol messages, plain clear UI copy. No new dependencies without a decision record.
