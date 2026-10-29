# Spec 036: View-only mode (DRAFT, needs a design)

Status: Todo | Package(s): host, viewer | Depends on: 011, 013, 034

## Goal

The host can let a viewer watch the screen without being able to move the mouse or type. A viewer who learns the PIN still cannot control the host.

## Why

Sharing the screen is often all that is needed (a broken panel, a demo, a second screen to read from). Control is the riskier half, so it should be something the host chooses, not something that is always on when the helper exe exists.

## Scope

- In: a host setting "Allow control" that is remembered; when off, the host tells the viewer `input-state { available: false }` and drops every `input` message from the engine, so a modified viewer cannot bypass it.
- Out: sharing one window instead of the screen, a virtual display, and any attempt at independent control of a second window. A Windows session has one pointer and one keyboard focus, so control stays shared and one person at a time.

## Screens

- Viewer: "Watching only" badge and the "Control is not available on this host" card exist in the Mouse and pointer lock hint (Confirmed). They are reused as they are.
- Host window: an "Allow control" switch is not in the `DESIGN.md` inventory. It needs a design before build (Not designed). Use existing components and tokens only.

## Protocol messages

None new. `input-state` already carries `available`. The host now sends `available = injector available AND allow-control`, and re-sends it when the setting changes while a viewer is connected.

## Design (SOLID)

- `InputBridge` stays as it is. A small `allowControl` flag lives in `controller.ts` next to the other settings and gates both the `input-state` message and the `input` event path before it reaches the bridge.
- `settings.ts` gains `allowControl` (default true, so existing behaviour does not change). Old settings files without the field load as true.
- The viewer needs no change if `input-state` already ends control (`setEnabled(false)` calls `release()`); confirm this in the build.

## New dependencies

None.

## Tasks (each task = one logical commit)

1. host: `allowControl` in settings (default true, validated on load) and in `HostState`.
2. host: gate `input-state` and incoming `input` events; send the new `input-state` when the switch changes; unit test the gate without Electron.
3. host: switch in the host window and a `set-allow-control` `HostAction` (after the design is Confirmed); validate the sender as for other actions.
4. viewer: confirm the badge and card appear and held buttons and keys are lifted when control is turned off mid-session.
5. docs: `docs/SECURITY_NOTES.md` row, journal page via `/learn 036`.

## Done when

- [ ] With "Allow control" off, a viewer sees "Watching only" and clicks and keys do nothing on the host.
- [ ] Turning it off while a viewer is controlling ends control at once and lifts held buttons and keys.
- [ ] A hand-made `input` message on the data channel is ignored when control is off (unit test).
- [ ] The setting survives a restart; an old settings file without it loads as on.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` pass.

## Manual test guide

Filled in by `/build`.

- **Failure case:** turn control off, then try to click from a viewer that was already controlling; nothing may reach the host.

## Release

Planned for 0.4.3 or 0.5.0, decided when it is built. It adds a user-visible feature, so 0.5.0 would follow strict SemVer.
