# Spec 035: Close-to-tray notice and Quit button (DRAFT, needs a design)

Status: Todo | Package(s): host | Depends on: 007, 034

Draft from real use: closing the host window only hides it (`controller.ts`, by design, so sharing continues from the tray), and the process stays in Task Manager. New users think the app did not close.

## Goal

People can tell that PilotPane is still running after they close its window, and can quit it from the host window without finding the tray menu.

## Design gate

Neither screen is in the `DESIGN.md` inventory yet, so this spec cannot be built until they are designed and marked Confirmed:

- A one-time notice on the first close: "PilotPane is still running in the tray. Use Quit in the tray menu to close it."
- A "Quit" button in the host window (the tray already has "Quit PilotPane").

Use only existing components and tokens (Card, Button, status dot). Add both rows to the inventory and to the canvas.

## Scope

- In: the notice (shown once, remembered in settings); the Quit button, which sends the existing `quit` action.
- Out: changing the close-to-tray behaviour itself.

## Done when (draft)

- [ ] The first close shows the notice once; later closes do not.
- [ ] The Quit button ends the app and all its processes.
- [ ] `pnpm format:check`, `pnpm build`, `pnpm test`, `pnpm scan` pass.

## Release

Planned for 0.4.3.
