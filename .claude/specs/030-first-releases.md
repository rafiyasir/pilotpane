# Spec 030: First releases

Status: Done | Package(s): tooling, docs | Depends on: 024, 025, 026, 027, 028

## Goal

Anyone can download any version of PilotPane from 0.1.0 to 0.4.1, and the whole release cycle, including a real in-app update, has been run on real machines.

## Scope

- In: making the repository public, protecting its branches, releasing 0.1.0, 0.2.0, 0.3.0, 0.4.0 and 0.4.1 in order (built by CI, signed by hand, installed and tested), fixing what the real update test finds, and writing the process down.
- Out: new app features, code signing of the installer, an automatic update check.

## Screens

No screens.

## Protocol messages

None.

## Design (SOLID)

- No new modules. The one code change is a single option on the process that runs the update script (`cwd`).
- Old versions are released from short side branches that hold one version-bump commit, so `dev` and `main` keep their history.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. Version 0.4.0 in the packages, and a changelog with an entry per version.
2. Site files for each release (`chore(site): publish X.Y.Z`), merged into `main`.
3. Skip the generated site files in Prettier.
4. Fix: run the update script outside the install folder.
5. Version 0.4.1 and its changelog entry.
6. Write the release process into `docs/DEPLOYMENT.md`.

## Done when

- [x] The repository is public, its history scan is clean and commit authors are noreply addresses
- [x] `main` and `dev` are protected by rulesets (pull request and passing check required)
- [x] Releases v0.1.0 to v0.4.1 exist, each with an installer and a portable zip (in-app updates exist from 0.2.0 and install from 0.4.0)
- [x] The download page and the signed manifest name the newest version
- [x] A real in-app update from 0.4.0 to 0.4.1 installs and the app restarts on 0.4.1
- [x] The process is written in `docs/DEPLOYMENT.md`

## Manual test guide

- **Host (Git Bash):** `sha256sum` the downloaded installer and compare it with the page. Run it and check Settings > Apps shows one PilotPane.
- **Viewer (Windows 8 / Chrome 109 laptop):** pair, move the mouse, type, pick Low and Auto.
- **Expected results:** each version shows its own number, upgrades in place, and 0.4.0 updates to 0.4.1 through Check for updates.
- **Failure case:** from 0.2.0, Check for updates downloads but the app restarts on 0.2.0 and the setup log says a file is in use. This is the bug fixed in 0.4.0.
