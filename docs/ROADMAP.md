# Roadmap

Each version is useful on its own and ships when its specs' acceptance criteria pass on real hardware (including the Windows 8 / Chrome 109 viewer).

Spec numbers are permanent. Status: Todo, In progress, Done, Dropped.

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
| 011 | Mouse events and pointer lock                | protocol, host, viewer | Done   |
| 012 | Low-bandwidth preset                         | host, viewer           | Done   |

## v0.3: Keyboard

| #   | Spec                          | Package                | Status |
| --- | ----------------------------- | ---------------------- | ------ |
| 013 | Keyboard events               | protocol, host, viewer | Done   |
| 014 | Capture mode and shortcut bar | protocol, viewer       | Done   |

## v0.4: Quality and reliability

| #   | Spec                             | Package                | Status  |
| --- | -------------------------------- | ---------------------- | ------- |
| 015 | Quality presets                  | protocol, viewer       | Done    |
| 016 | Auto-reconnect after host sleep  | host, viewer           | Done    |
| 017 | Keep host from sleeping          | host                   | Done    |
| 031 | Performance and sharpness        | host, viewer           | Done    |
| 032 | Lighter package                  | tooling                | Dropped |
| 033 | Local cursor on the viewer       | viewer                 | Todo    |
| 034 | Pause that both sides understand | protocol, host, viewer | Done    |
| 035 | Close notice and Quit button     | protocol, host         | Done    |
| 036 | View-only mode                   | host, viewer           | Todo    |
| 037 | Automatic codec                  | protocol, viewer       | Done    |
| 038 | Codec choice in the toolbar      | protocol, viewer       | Todo    |

Planned releases: 031, 034, 035 and 037 ship as 0.4.3 (037 protects old viewers from 031's VP8 default); 033 and 038 as 0.4.4. Spec 038 needs a designed screen first. 0.5.0 stays for specs 018 to 021. Spec 034 changes `PROTOCOL_VERSION` (2 to 3), so call it out in the changelog.

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

| #   | Spec                                  | Package        | Status |
| --- | ------------------------------------- | -------------- | ------ |
| 024 | Packaging (portable build)            | host, tooling  | Done   |
| 025 | Windows installer                     | tooling        | Done   |
| 026 | In-app updates (signed manifest)      | protocol, host | Done   |
| 027 | Release pipeline and download website | tooling, docs  | Done   |
| 028 | Secret scan (own script)              | tooling        | Done   |
| 030 | First releases (0.1.0 to 0.4.1)       | tooling, docs  | Done   |

## Later

If people use it: file drop, audio, multi-monitor, touch viewer, extended display, macOS and Linux hosts.
