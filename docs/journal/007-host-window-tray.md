# SPEC 007: Host window, tray and big PIN

`v0.1` · `apps/host/src/renderer` · merged 2026-10-21 · progress 7 of 22 specs

**In one line:** the host app now has a face: a full-screen PIN on start, a control window, and a tray icon that keeps it running when the window is closed.

## 1. What we built and where it lives

| Path | What it does | State |
|---|---|---|
| `apps/host/src/renderer/pin/` | Full-screen PIN page with the address; closes by itself when a viewer pairs | Changed |
| `apps/host/src/renderer/host/` | Control window: ready, connected and problem views, theme chips | Changed |
| `apps/host/src/renderer/shared/` | `theme.css` (four themes) and `ui.ts` (helpers and the typed bridge) | Changed |
| `apps/host/src/main/tray.ts` | Tray icon, tooltip and menu | Changed |
| `apps/host/assets/` | App icon and tray icons (normal and 2x) | Changed |
| `apps/host/src/main/controller.ts` | Publishes `HostState` that these pages render | Uses it |
| `apps/host/src/main/preload.cts` | The only way these pages talk to main | Uses it |
| `apps/viewer` | Unrelated to this spec | Untouched |

## 2. Decisions and the reasons

- **We chose** Electron windows and the tray API **instead of** a native shell **because** the whole host already runs on Electron, so windows, tray and capture share one language and one build (ADR-001).
- **We chose** pages that only render a `HostState` and send `HostAction` messages **instead of** letting pages decide things **because** all rules stay in main, where they can be tested, and renderers stay sandboxed (CLAUDE.md, renderer rules).
- **We chose** to keep the app in the tray when the window closes **instead of** quitting **because** a remote screen tool must keep running while the window is out of the way. Double-clicking the tray icon brings the big PIN back.
- **We chose** a single viewer in the window **instead of** a list **because** only one viewer can be active (ADR-005).
- **We chose** plain-English messages for port-busy and no-network **instead of** error codes **because** the screen should tell the user what to do, never blame them.

## 3. Where this sits in the journey

- **Built on:** spec 005 gave us `HostState`, actions and the preload bridge, and spec 004 the PIN and the single viewer.
- **Unlocks:** spec 008 shows the viewer's stream numbers in this window.

## 4. How it works

1. On start the controller opens the big PIN window, always on top and full screen, with the PIN and the viewer address.
2. The control window and the PIN window ask main for the current `HostState` and listen for changes.
3. Buttons such as "New PIN", "Pause sharing" and "Disconnect viewer" send a `HostAction`. Main checks the sender and acts.
4. When a viewer pairs, the PIN window closes by itself and the control window switches to the connected view.
5. The tray menu offers the same actions. Closing the control window hides it. Only "Quit PilotPane" ends the app.

## 5. The code that matters

```ts
export function viewerUrl(state: HostState): string | null {
  const first = state.addresses[0];
  return first ? `http://${first.address}:${state.port}` : null;
}

export function formatPin(pin: string): string {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}
```

```ts
  constructor(
    iconPath: string,
    private readonly act: (action: HostAction) => void,
    private readonly openHostWindow: () => void
  ) {
    this.tray = new Tray(nativeImage.createFromPath(iconPath));
    this.tray.setToolTip('PilotPane');
    this.tray.on('double-click', () => this.act({ action: 'show-pin-screen' }));
    this.tray.on('click', () => this.openHostWindow());
  }
```

## 6. Concepts to go deeper

- **Tray icons**: [Electron: Tray](https://www.electronjs.org/docs/latest/api/tray)
- **Windows**: [Electron: BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)
- **Keeping the display awake**: [Electron: powerSaveBlocker](https://www.electronjs.org/docs/latest/api/power-save-blocker)
- **Safe defaults for renderers**: [Electron: Security](https://www.electronjs.org/docs/latest/tutorial/security)
- **Themes with custom properties**: [MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

## 7. Check yourself

1. Why do the pages send actions instead of changing state themselves?
2. What happens to the app when you close the control window?
3. Why does `viewerUrl` return `null` in some states?

<details>
<summary>Answers</summary>

1. Main owns the rules and can validate the sender of each message. A renderer is only a view, so a bug there cannot break pairing or streaming.
2. Nothing stops. The app stays in the tray and keeps listening. Only the tray's "Quit PilotPane" ends it.
3. With no local network there is no address to show, so the tray greys out "Copy viewer address" instead of copying something wrong.

</details>

## Bugs I hit

None worth a write-up for this spec.

## Commits

- `feat(host): add shared renderer theme and ui helpers`
- `feat(host): add big pin screen`
- `feat(host): add control window`
- `feat(host): add tray menu`
- `chore(host): add app and tray icons`

[Compare spec-006-done...spec-007-done](https://github.com/rafiyasir/pilotpane/compare/spec-006-done...spec-007-done)
