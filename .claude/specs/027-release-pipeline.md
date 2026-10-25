# Spec 027: Release pipeline and download website

Status: Done | Package(s): tooling, docs | Depends on: 024, 025, 026

## Goal

Pushing a `vX.Y.Z` tag builds the installer and portable zip on GitHub and attaches them to a draft release. One local command then signs the update manifest (the key never leaves the maintainer's machine) and writes the download page, so a release merge publishes both the website and the in-app update.

## Scope

- In: tag-triggered release workflow, `SHA256SUMS` asset, a `release-sign` script that fetches the released installer, checks it, signs the manifest and renders the download page, a live download count on the page (one call to the GitHub API, release-time number as fallback), the static download page, release steps in the docs and the `/release` command, ADR-012.
- Out: counting installs or active users (needs the app to phone home), code signing of the exe (SmartScreen stays), automatic signing in CI, update channels, a custom domain, analytics, macOS and Linux builds.

## Screens

From the DESIGN.md inventory: "Download page" (Confirmed), layout in the "Download page (website)" section: theme bar, header, hero with chips, laptop illustration (inline SVG), download card with live count, Windows note, three steps, footer. Built only from existing tokens and components, plus inline SVG icons drawn in token colours. The header has a GitHub link only (no journal link). No app screens change.

## Protocol messages

None.

## Design (SOLID)

- `.github/workflows/release.yml`: on push of tag `v*`, runs on `windows-latest`: install (Electron binary included), `pnpm test`, `pnpm package`, `pnpm installer`, writes `SHA256SUMS`, creates a **draft** release with the installer, zip and sums. Fails if the tag does not match the root `package.json` version. Permission `contents: write` only.
- `scripts/lib/release.mjs`: pure helpers, no network: `parseSums(text)`, `renderDownloadPage(template, info)`, `checkTagMatchesVersion(tag, version)`, `sumDownloads(releasesJson)`. Unit tested.
- `scripts/lib/release-flow.mjs`: `signRelease(...)`, the checks and renders, with `readAsset` and `fetchJson` injected so tests use fakes. `scripts/release-ci.mjs`: `check-tag` and `sums` steps for the workflow.
- `scripts/release-sign.mjs`: plain Node CLI. Takes `--version`, `--key`, optional `--note` (repeat). Gets `SHA256SUMS`, the installer and the zip from the draft release with the GitHub CLI (draft assets are not public), or from a folder given with `--dir`. Checks both files against `SHA256SUMS`, then calls the same signing code as `sign-manifest.mjs` (reused, not copied) and fetches the current download total (failure is not fatal, it uses 0), and writes `docs/update/manifest.json` and `docs/index.html`.
- `docs/index.html` is rendered from `docs/site/index.template.html` plus `docs/site/site.css` (token copy of the viewer theme, four themes). The version, size, SHA-256 and download total are filled in at release time, so the page is complete without a script.
- `docs/site/site.js`: one job, the live count. Calls `https://api.github.com/repos/rafiyasir/pilotpane/releases`, uses `sumDownloads`, caches the result in `sessionStorage` for 5 minutes (wrapped in try/catch), updates the "N downloads" line, and on any failure leaves the release-time number. A `<meta>` Content-Security-Policy allows only `self` and `connect-src https://api.github.com`. The count logic is in a pure function shared with `scripts/lib/release.mjs` tests, or duplicated with a test that checks both agree.
- Key handling: the private key is a local file, never a CI secret and never in the repo (keeps ADR-011).

## New dependencies

None. Node `fetch`, `crypto`, the GitHub CLI on the maintainer's machine (a tool, not a package of ours), and GitHub Actions' own `actions/*` steps (official, same as `ci.yml`). Add ADR-012: why CI builds but the maintainer signs, and why the page is rendered at release time instead of read from the API.

## Tasks (each task = one logical commit)

1. `scripts/lib/release.mjs` and its tests (`parseSums`, tag check, page rendering).
2. `docs/site/` template and CSS for the download page: hero, illustration and icons as inline SVG, theme switcher with swatches, download card, steps, all four themes, phone layout (stacked steps, full-width button), reduced-motion, focus ring.
3. `scripts/release-sign.mjs`, reusing the signing code from `sign-manifest.mjs` (move shared parts to `scripts/lib/`); tests with a fake fetch.
4. `.github/workflows/release.yml`.
5. `package.json` script `release:sign`; update the `/release` command with the new phases (tag, wait for draft, sign, publish).
6. `docs/site/site.js` live count with cache, fallback and CSP meta.
7. Docs: `DEPLOYMENT.md` (release flow, Pages root), ADR-012 in `DECISIONS.md`, README download link, `SECURITY_NOTES.md` download-page section, `ROADMAP.md`, CHANGELOG.

## Done when

- [ ] Pushing tag `v0.0.0-test` on a fork builds and attaches installer, zip and `SHA256SUMS` to a draft release.
- [ ] A tag that differs from `package.json` version fails the workflow before building.
- [ ] `pnpm release:sign` writes a `manifest.json` that the app's `verifyManifest` accepts, and refuses when the installer or zip does not match `SHA256SUMS`.
- [ ] The private key is only read from the `--key` path; nothing in the workflow or repo references it.
- [ ] `docs/index.html` shows version, size and short SHA-256, a working Download link and the SmartScreen note, and works with scripts off. Its only network request is the GitHub API call for the count.
- [ ] With the network blocked or the API failing, the page still shows the release-time count and no error.
- [ ] After a real download of the release installer, reloading the page shows the count increased (GitHub may lag briefly).
- [ ] The page matches the DESIGN.md layout in all four themes; the dashed line animation stops with reduced motion on; the theme choice is remembered and the page still works with storage blocked.
- [ ] The page passes contrast in all four themes and has no horizontal scroll at 360 px.
- [ ] Unit tests cover `parseSums`, `sumDownloads` (several releases, missing assets), tag check, page rendering and the hash mismatch refusal.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test` pass.

## Manual test guide

Part A needs no GitHub and no GitHub CLI. Part B runs the real workflow and needs a pushed test tag. All commands are for Git Bash in the project folder, on branch `spec/027-release-pipeline` after `pnpm install && pnpm build`.

**Part A: sign a fake release**

1. Make fake files and sign them (everything goes in `out/release-test`, which git ignores):

```bash
mkdir -p out/release-test
printf 'MZ fake installer' > out/release-test/PilotPane-Setup-0.2.0.exe
printf 'PK fake zip' > out/release-test/PilotPane-0.2.0-win-x64.zip
node scripts/release-ci.mjs sums out/release-test/PilotPane-Setup-0.2.0.exe out/release-test/PilotPane-0.2.0-win-x64.zip --out out/release-test/SHA256SUMS
node scripts/sign-manifest.mjs keygen out/release-test/key
pnpm release:sign -- --version 0.2.0 --key out/release-test/key/update-private.pem --dir out/release-test --out-dir out/release-test/site --note "Test note"
```

Expect `signed v0.2.0: sha256 ...` and two `wrote` lines. To run it again, first delete the folder `out/release-test` in File Explorer (the key step refuses to overwrite an old key).

2. `start "" out/release-test/site/index.html`. Expect the page from `DESIGN.md`: amber "your screen.", two laptops with a moving dashed line, a download card with `0.2.0`, three step cards with readable numbers, a GitHub link only in the header, and no downloads line (the count is 0).
3. Click the four theme buttons, then reload: colours change and the last choice stays.
4. Optional page checks (developer tools): one request to `api.github.com` only; offline shows no error; 360 px width has one column and no sideways scroll; JavaScript off still shows the full page; reduced motion stops the dashed line; the Windows 8 / Chrome 109 laptop opens the folder `out/release-test/site` and shows the same page.

Failure cases, each must be refused with a clear message:

- `echo x >> out/release-test/PilotPane-Setup-0.2.0.exe`, then `release:sign` again with `--out-dir out/release-test/site2`: "does not match SHA256SUMS, so it was not signed", and `site2` is not created.
- `release:sign` without `--key`: "missing --key".
- `node scripts/release-ci.mjs check-tag v0.1.0` passes; `check-tag v9.9.9` fails with "does not match package.json version".

**Part B: the real workflow (no GitHub CLI needed)**

The spec work must be committed on the branch first, so `release.yml` is in the tagged commit.

1. Throwaway branch and tag: `git checkout -b fix/release-test`, `npm pkg set version=0.0.1`, commit `package.json`, push the branch, then `git tag v0.0.1` and `git push origin v0.0.1`.
2. In the browser: Actions tab, run "Release". Expect all steps green and a **Draft** release "PilotPane 0.0.1" with the installer, the zip and `SHA256SUMS`.
3. Download the three files from the draft in the browser into `out/release-b`.
4. `node scripts/sign-manifest.mjs keygen out/release-b/key`, then `pnpm release:sign -- --version 0.0.1 --key out/release-b/key/update-private.pem --dir out/release-b --out-dir out/release-b/site --note "Trial release"`. Expect `signed v0.0.1`, and a hash start that matches the installer line in `SHA256SUMS`.
5. `start "" out/release-b/site/index.html`: version 0.0.1, a real size in MB, the same short hash, and a Download button for `.../v0.0.1/PilotPane-Setup-0.0.1.exe`.
6. Failure: `git tag v0.0.2` and `git push origin v0.0.2` (package.json still says 0.0.1). The run fails in the first step with "does not match package.json version 0.0.1", with no build and no new draft.
7. Optional: publish the draft, download the installer once, wait a minute or two, reload the page: "1 downloads" appears.
8. Clean up: delete the draft in the browser, then `git push origin --delete v0.0.1 v0.0.2 fix/release-test`, `git tag -d v0.0.1 v0.0.2`, and return to the spec branch.
