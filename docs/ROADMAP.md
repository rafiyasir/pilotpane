# Roadmap

Each version is useful on its own and ships when its specs' acceptance criteria pass on real hardware (including the Windows 8 / Chrome 109 viewer).

Spec numbers are permanent. Status: Todo, In progress, Done.

## v0.1: See the screen

| #   | Spec                          | Package      | Status |
| --- | ----------------------------- | ------------ | ------ |
| 001 | Monorepo scaffold             | all          | Done   |
| 002 | Typed protocol                | protocol     | Done   |
| 003 | Own HTTP and WebSocket server | host         | Done   |
| 004 | PIN pairing                   | host, viewer | Done   |
| 005 | Screen capture and WebRTC     | host, viewer | Done   |
| 006 | Viewer page for Chrome 109    | viewer       | Done   |
| 007 | Host window, tray and big PIN | host         | Done   |
| 008 | Status and stats overlay      | host, viewer | Done   |

## v0.2: Mouse and low bandwidth

| #   | Spec                                         | Package                | Status |
| --- | -------------------------------------------- | ---------------------- | ------ |
| 009 | Host interfaces and smaller services         | host                   | Done   |
| 010 | Own C# SendInput helper behind InputInjector | host                   | Done   |
| 011 | Mouse events and pointer lock                | protocol, host, viewer | Todo   |
| 012 | Low-bandwidth preset                         | host, viewer           | Todo   |

## v0.3: Keyboard

| #   | Spec                          | Package                | Status |
| --- | ----------------------------- | ---------------------- | ------ |
| 013 | Keyboard events               | protocol, host, viewer | Todo   |
| 014 | Capture mode and shortcut bar | viewer                 | Todo   |

## v0.4: Quality and reliability

| #   | Spec                            | Package      | Status |
| --- | ------------------------------- | ------------ | ------ |
| 015 | Quality presets                 | host, viewer | Todo   |
| 016 | Auto-reconnect after host sleep | host, viewer | Todo   |
| 017 | Keep host from sleeping         | host         | Todo   |

## v0.5: Daily-use comfort

| #   | Spec                           | Package                | Status |
| --- | ------------------------------ | ---------------------- | ------ |
| 018 | Optional HTTPS                 | host, viewer           | Todo   |
| 019 | Clipboard sync                 | protocol, host, viewer | Todo   |
| 020 | Start on login and ready sound | host                   | Todo   |
| 021 | Trusted devices                | host, viewer           | Todo   |

## v0.6: Host screen off

| #   | Spec               | Package | Status |
| --- | ------------------ | ------- | ------ |
| 022 | Virtual display    | host    | Todo   |
| 023 | Safe panel restore | host    | Todo   |

## Distribution: download, install, update

Built before spec 011 so the app can be shared. Spec numbers are permanent, so these come after 023.

| #   | Spec                                  | Package        | Status      |
| --- | ------------------------------------- | -------------- | ----------- |
| 024 | Packaging (portable build)            | host, tooling  | Done        |
| 025 | Windows installer                     | tooling        | Done        |
| 026 | In-app updates (signed manifest)      | protocol, host | Done        |
| 027 | Release pipeline and download website | tooling, docs  | In progress |

## Later

If people use it: file drop, audio, multi-monitor, touch viewer, extended display, macOS and Linux hosts.
