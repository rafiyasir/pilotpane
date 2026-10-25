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
| Mouse and pointer lock hint                           | Mouse hint             | v0.2    | Confirmed    |
| Low-bandwidth preset in the toolbar                   | Low-bandwidth preset   | v0.2    | Confirmed    |
| Keyboard capture mode and shortcut bar                | Shortcut bar           | v0.3    | Confirmed    |
| Host update available (version, notes, Download)      | Host: update available | v0.4    | Confirmed    |
| Host updating (progress, then Restart to install)     | Host: updating         | v0.4    | Confirmed    |
| Host update problem (check failed, bad signature)     | Host: update problem   | v0.4    | Confirmed    |
| Tray menu item "Check for updates"                    | Tray menu              | v0.4    | Confirmed    |
| Settings (HTTPS, clipboard, start on login)           | none                   | v0.5    | Not designed |
| Trusted devices                                       | none                   | v0.5    | Not designed |
| Host screen off                                       | none                   | v0.6    | Not designed |
| Download page (website on GitHub Pages)               | Download page          | v0.4    | Confirmed    |

## Low-bandwidth preset (v0.2)

Built only from existing components and tokens. The viewer's quality control is the existing select in the toolbar; it gains one option, "Low", after 720p. The first time someone picks Low, a Card appears at the bottom of the stream, like the mouse hint: `info` dot, "Low data mode is on.", "Smaller picture and fewer frames, for slow links. Pick 720p when the link is better.", and a plain "Got it". Shown once per browser, then hidden. No other states.

The select also gains "Auto" (spec 015), listed first. The stats overlay gains one more pair, "quality", showing the preset in use. No other UI.

## Keyboard shortcuts (v0.3)

Built only from existing components and tokens. Capture mode is the existing Controlling state from the mouse hint: while controlling, the viewer sends every key the browser lets it have. On plain HTTP the browser keeps a few combinations for itself, so a shortcut bar sends those instead.

| State                   | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shortcut bar            | Card strip of four Chips at the bottom centre of the stream, above the "Esc to let go" pill: "Alt+Tab", "Win", "Alt+F4", "Ctrl+W". One tap or click sends the whole combination once (down, then up). Chips are not toggles. The bar has a grip on the left (drag to move it), a small opacity slider (40% to 100%) and a corner handle on the bottom right (drag to resize, 75% to 200%). Position, size and opacity are kept per browser. The bar never leaves the stream. |
| Toolbar chip            | A "Shortcuts" Chip in the toolbar shows or hides the bar (pressed = `accent` bg + `on-accent` while the bar is open). Disabled while Viewing or Watching only.                                                                                                                                                                                                                                                                                                               |
| Viewing / Watching only | Bar hidden, toolbar chip disabled.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| First time              | Card at the bottom with an `info` dot: "Some keys stay with this browser." and "Use the Shortcuts bar for Alt+Tab, Win and similar keys." with a plain "Got it". Shown once per browser, then hidden.                                                                                                                                                                                                                                                                        |

The grip, slider and handle use only existing tokens (`muted` for the grip and handle, `accent` for the slider). Esc is not on the bar: it always lets go of control and is never sent to the host. Ctrl+Alt+Del is not on the bar because Windows blocks it from software. Using the bar must not release control.

## Update screens (v0.4)

Built only from existing components and tokens, in all four themes. They appear in the host window as a Card under the status area; the app never checks by itself, only after "Check for updates" in the tray menu or the host window.

| Screen         | Content                                                                                                                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update ready   | Status dot `accent`, "Update available" and the new version in mono. Card with "You have X. What is new:" and up to three lines of notes. Primary "Download", plain "Later". Also covers "You are up to date" as a short `ok` line with no buttons.                                                  |
| Updating       | Status dot `accent`, "Downloading X". Thin progress bar (8 px, `line` track, `accent` fill), mono "41 of 66 MB". Then "Checking the update". When ready: primary "Restart to install".                                                                                                               |
| Update problem | Status dot `err`, "Could not update". Card explains in plain words and says the current version is kept (for example "The update did not pass the safety check, so it was not installed."). Primary "Try again", plain "Keep this version". Covers no connection, bad signature and failed download. |
| Tray item      | One menu item "Check for updates" after "New PIN". Always this text; results show in the host window.                                                                                                                                                                                                |

## Mouse and pointer lock hint (v0.2)

Built only from existing components and tokens. The canvas "Mouse hint" shows each state in Cockpit and the first hint plus Controlling in all four themes.

| State                | Content                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First hint           | Card at the bottom of the stream: "Click the screen to control it." and "Press Esc to let go." with a plain "Got it". Toolbar badge "Viewing". Shown once per browser, then hidden. |
| Controlling          | 2 px `accent` outline around the stream. Badge becomes "Controlling" (`accent` bg, `on-accent` text). A small pill "Esc to let go · Ctrl+Alt+Shift for toolbar" at the bottom.      |
| Released             | Badge back to "Viewing". A pill at the bottom says "Click to control again."                                                                                                        |
| Pointer lock missing | Card with an `info` dot: "Your mouse still works." and "This browser cannot lock the pointer, so it can leave the window." with "Got it". Not an error.                             |
| Host has no input    | Badge "Watching only". Card with an `info` dot: "Control is not available on this host." and "You can still watch the screen." with "Got it".                                       |

## Download page (website)

One static page, `docs/index.html`, served by GitHub Pages at the project root. Cockpit theme by default, with the same four themes and the same tokens as the viewer (a copy of the token CSS, no new tokens). Glow and tints are gradients and opacity over existing tokens (no `color-mix`, so old Chrome renders them). System fonts only, no trackers, no fonts or images from other sites. Everything is readable without scripts. One small script adds two optional extras: the theme picker (remembers the choice) and the live download count. The only request the page makes is one call to `api.github.com` for that count (sends the visitor's IP to GitHub, stated in the security notes). A design preview of the page lives in the maintainer's artifacts; the layout below is the source of truth.

Layout, one column, max width 760 px, 16 px side gutters on a phone:

| Block        | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme bar    | Four pills with a swatch (theme background with its accent dot) and the theme name: Cockpit, Daylight, Midnight, Contrast. The active pill has an `accent` outline.                                                                                                                                                                                                                                                                                                                                         |
| Header       | Small logo mark and "PilotPane" wordmark on the left, a plain "GitHub" link on the right. No other links.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Hero         | Label (uppercase `muted`, `ok` dot) "Free, LAN only". Headline "Use an old laptop as your screen." with "your screen." in `accent`. Line: "PilotPane streams your Windows screen to any browser on your network. No account, no cloud." Three chips: "No account needed", "Nothing leaves your network", "Open source, MIT". Soft `accent` glow behind it, weaker in Daylight, stronger in Midnight, none in Contrast.                                                                                      |
| Illustration | Framed stage on a faint grid: a Windows laptop on the left ("Your Windows laptop"), an older laptop on the right ("Any browser, even an old one"), a dashed `accent` line between them labelled "Your network only" with a PIN chip above it. The dash animates, and stops under `prefers-reduced-motion`. Token colours only, `role="img"` with a text alternative.                                                                                                                                        |
| Download     | Main card with an `accent` border. App icon (the small logo mark), "PilotPane for Windows" and the version in mono. Primary button "Download for Windows" with a download arrow, 48 px high, plus a plain "Portable zip" link. Mono line "Windows 10 and 11, size, SHA-256 (first 16 characters, full value in a `title`)". Then a `muted` line with an `ok` check: "N downloads" (mono number), shown first from the release-time value and swapped for the live value when GitHub answers, hidden when 0. |
| Windows note | Card with an `info` icon. "Windows may warn you. It can say 'Windows protected your PC' because the installer is not code signed yet. Choose More info, then Run anyway. You can compare the SHA-256 above with the one on the release page."                                                                                                                                                                                                                                                               |
| Steps        | Heading "Three steps", then three Cards in a row, each with a number circle (`accent` bg), a line icon and a short title and sentence: "Install", "Open the address", "Type the PIN". On a phone they stack and the icons are hidden.                                                                                                                                                                                                                                                                       |
| Footer       | "MIT license", "Security notes", "Report a problem" links, and the author credit. No em dashes.                                                                                                                                                                                                                                                                                                                                                                                                             |

States: if the live count fails (offline, rate limited, blocked), the release-time number stays and no error is shown. If the page cannot read the release (links are written into the page at release time, so this only happens if a file is missing), the Download card shows the "Releases on GitHub" link instead of a button. On a phone the layout is one column and the button is full width. Focus ring and contrast rules are the same as for the app.

## Logo

"Pane + cursor": a window pane with a cursor. Use the small mark (pane and cursor only, no wordmark) below 24 px, including the tray icon. Use theme token colours only, one colour per mark; do not stretch or rotate it. The design canvas holds the logo system. App and tray icons live in `apps/host/assets/`; exported logo files go in `docs/design/`.
