# Design system

Source of truth for all UI. Tokens: `design/tokens.json` (colours mirror `apps/viewer/src/theme.css`; the host windows use `apps/host/src/renderer/shared/theme.css`). The design canvas holds every screen in every theme. Do not redesign per feature; do not invent tokens.

## Themes

| Theme    | Use                                  | Notes                                      |
| -------- | ------------------------------------ | ------------------------------------------ |
| Cockpit  | default, dark navy with amber accent | the look of the project                    |
| Daylight | light                                | accent darkened so text on it passes 4.5:1 |
| Midnight | true black (OLED, dark rooms)        |                                            |
| Contrast | maximum contrast, white lines        | yellow accent, black text on it            |

Rules every theme passes: body text 4.5:1 on `bg` and `surface`; `on-accent` on `accent` 4.5:1; focus ring (2 px accent, 2 px offset) visible on every surface. Tokens per theme: `bg`, `surface`, `surface2`, `text`, `muted`, `line`, `accent`, `on-accent`, `ok`, `err`, `info`, `desk`. Add a token to all four themes or not at all.

## Typography

System fonts only, because the app must work with no internet and on Windows 8: UI `Segoe UI` with `system-ui` fallback, display `Segoe UI Semibold`, numbers and PINs `Consolas` (mono). Labels are 13 px uppercase with 1.5 px letter spacing in `muted`; buttons 15 px semibold. The learning journal may use web fonts; the app never does.

## Components

| Component     | Spec                                                                                                                                                                       | Seen in                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Button        | 44 high, radius 8, 1 px `line` border, `surface` bg; hover border `accent`. Variants: primary (`accent` bg, `on-accent` text), danger (transparent, `err` border and text) | PIN form, status cards, host window  |
| Chip          | 34 high pill, 13 px semibold; pressed = `accent` bg + `on-accent`                                                                                                          | quality (1080p / 720p), theme picker |
| Card          | `surface` bg, 1 px `line` border, radius 8, padding 16                                                                                                                     | status card, host window sections    |
| Status dot    | 12 px circle; `accent` working, `ok` connected, `err` problem                                                                                                              | toolbar, host window                 |
| Toolbar       | top overlay on the stream, shown when the mouse moves to the top; host dot and name, mode badge, quality chips, Stats, Fullscreen, Disconnect                              | Viewer: streaming                    |
| Stats overlay | small `surface` panel over the stream, mono values: latency, fps, bitrate, size, codec, loss                                                                               | Viewer: stats overlay                |
| PIN digits    | six mono boxes, large on the host PIN screen                                                                                                                               | Viewer: PIN entry, PIN screen        |

## States

Every screen handles: loading (spinner on the status card), empty, error (message plus a way forward, never a blank screen) and reconnecting (last frame stays under a banner). Copy is plain English, short, and never blames the user. No em dashes.

## Screen inventory

Status: Confirmed = build to the canvas. Not designed = stop and ask for a design.

| Screen                                                | Canvas name            | Version | Status       |
| ----------------------------------------------------- | ---------------------- | ------- | ------------ |
| Host PIN (full screen)                                | PIN screen             | v0.1    | Confirmed    |
| Host ready (address, PIN, New PIN, Pause)             | Host: ready            | v0.1    | Confirmed    |
| Host with a viewer (viewer, duration, stats)          | Host: viewer connected | v0.1    | Confirmed    |
| Host problem (port busy, no network, capture failed)  | Host: problem          | v0.1    | Confirmed    |
| Host paused                                           | Host: paused           | v0.1    | Confirmed    |
| Tray menu                                             | Tray menu              | v0.1    | Confirmed    |
| Viewer PIN form                                       | Viewer: PIN entry      | v0.1    | Confirmed    |
| Viewer connecting                                     | Viewer: connecting     | v0.1    | Confirmed    |
| Viewer locked after wrong PINs                        | Viewer: locked         | v0.1    | Confirmed    |
| Viewer busy (someone else connected)                  | Viewer: busy           | v0.1    | Confirmed    |
| Viewer streaming with toolbar                         | Viewer: streaming      | v0.1    | Confirmed    |
| Viewer stats overlay                                  | Viewer: stats overlay  | v0.1    | Confirmed    |
| Viewer reconnecting                                   | Viewer: reconnecting   | v0.1    | Confirmed    |
| Viewer error (version mismatch, cannot play, stopped) | Viewer: error          | v0.1    | Confirmed    |
| Mouse and pointer lock hint                           | none                   | v0.2    | Not designed |
| Low-bandwidth preset in the toolbar                   | none                   | v0.2    | Not designed |
| Keyboard capture mode and shortcut bar                | none                   | v0.3    | Not designed |
| Host update available (version, notes, Download)      | Host: update available | v0.4    | Confirmed    |
| Host updating (progress, then Restart to install)     | Host: updating         | v0.4    | Confirmed    |
| Host update problem (check failed, bad signature)     | Host: update problem   | v0.4    | Confirmed    |
| Tray menu item "Check for updates"                    | Tray menu              | v0.4    | Confirmed    |
| Settings (HTTPS, clipboard, start on login)           | none                   | v0.5    | Not designed |
| Trusted devices                                       | none                   | v0.5    | Not designed |
| Host screen off                                       | none                   | v0.6    | Not designed |

## Update screens (v0.4)

Built only from existing components and tokens, in all four themes. They appear in the host window as a Card under the status area; the app never checks by itself, only after "Check for updates" in the tray menu or the host window.

| Screen         | Content                                                                                                                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update ready   | Status dot `accent`, "Update available" and the new version in mono. Card with "You have X. What is new:" and up to three lines of notes. Primary "Download", plain "Later". Also covers "You are up to date" as a short `ok` line with no buttons.                                                  |
| Updating       | Status dot `accent`, "Downloading X". Thin progress bar (8 px, `line` track, `accent` fill), mono "41 of 66 MB". Then "Checking the update". When ready: primary "Restart to install".                                                                                                               |
| Update problem | Status dot `err`, "Could not update". Card explains in plain words and says the current version is kept (for example "The update did not pass the safety check, so it was not installed."). Primary "Try again", plain "Keep this version". Covers no connection, bad signature and failed download. |
| Tray item      | One menu item "Check for updates" after "New PIN". Always this text; results show in the host window.                                                                                                                                                                                                |

## Logo

"Pane + cursor": a window pane with a cursor. Use the small mark (pane and cursor only, no wordmark) below 24 px, including the tray icon. Use theme token colours only, one colour per mark; do not stretch or rotate it. The design canvas holds the logo system. App and tray icons live in `apps/host/assets/`; exported logo files go in `docs/design/`.
