# PilotPane

**Control your Windows laptop from any device with a browser on your local network.**

PilotPane turns any laptop with a browser into a screen for your Windows PC, over your own local network. Nothing to install on the viewer, no account, no cloud. It was built to rescue a laptop with a broken display, using an old Windows 8 laptop running Chrome 109 as the screen.

> **Status: v0.1, "see the screen".** The viewer shows the host's screen live. Mouse control arrives in v0.2 and keyboard control in v0.3 (see the [roadmap](docs/ROADMAP.md)). Until then, keep using the host's own keyboard and touchpad while you watch the viewer.

## Download

Get the Windows installer from the [download page](https://rafiyasir.github.io/pilotpane/) or the [releases](https://github.com/rafiyasir/pilotpane/releases). The installer is not code signed yet, so Windows may show "Windows protected your PC": choose **More info**, then **Run anyway**.

## Why another remote desktop tool?

- **Zero install on the viewer, works on old browsers.** Chrome 109 on Windows 8 is a first-class target.
- **Broken-screen rescue.** Starts with a huge, high-contrast PIN you can read on a faulty panel, and never needs the host's screen after that.
- **Private by design.** LAN only, PIN pairing, no account, nothing leaves your network.
- **Small, readable TypeScript.** The core (WebSocket server, SHA-256, pairing) is written by hand, with no third-party runtime packages. Good for learning and easy to audit.

Out of scope on purpose: internet access, accounts, cloud sync, recording.

## Quick start (host: Windows 10/11)

You need [Node.js](https://nodejs.org) 22.12 or newer, pnpm 10, and Git.

```bash
git clone https://github.com/<you>/pilotpane.git
cd pilotpane
pnpm install
pnpm start
```

What happens:

1. Windows asks whether Electron may use the network. **Allow it on Private networks**, and on Public too if you'll use a direct cable (see [connections](docs/CONNECTIONS.md#firewall)).
2. A full-screen page shows a **6-digit PIN** and an **address** like `192.168.1.12:7420`. A small PilotPane window and a tray icon appear too.
3. On the other laptop, open Chrome and type that address. Enter the PIN.
4. The host's screen appears. Press Esc on the host to hide the big PIN at any time; double-click the tray icon to bring it back.

Options: `pnpm start -- --port 7500` uses another port. Logs go to the terminal; set `PILOTPANE_LOG=debug` for more.

To build a portable copy that runs without Node or the source (for testing on another PC), run `pnpm package`. It writes `out/PilotPane-<version>-win-x64/` and a zip of it. See [deployment](docs/DEPLOYMENT.md#portable-package).

To build a one-file installer (`out/PilotPane-Setup-<version>.exe`, installs for the current user, no admin needed), run `pnpm installer`. See [deployment](docs/DEPLOYMENT.md#installer).

## Connecting the two laptops

Any shared local network works. Full steps for each are in **[docs/CONNECTIONS.md](docs/CONNECTIONS.md)**.

| Connection                         | Speed  | Notes                                                    |
| ---------------------------------- | ------ | -------------------------------------------------------- |
| Same router (cable or Wi-Fi)       | Best   | Easiest and most reliable                                |
| Direct Ethernet cable              | Best   | Set two static IPs once (steps included)                 |
| Windows Mobile hotspot on the host | Good   | Over Wi-Fi, or over Bluetooth if the viewer has no Wi-Fi |
| Phone USB tethering                | Varies | May work, depends on the phone                           |
| Bluetooth network (PAN)            | Slow   | Fallback only; use 720p                                  |

## Security

- Listens only on private LAN addresses (10.x, 172.16-31.x, 192.168.x, 169.254.x), never on public ones.
- A new 6-digit PIN each start. The PIN itself never crosses the network: the viewer sends a one-time SHA-256 proof.
- Five wrong PINs pause pairing for 60 seconds. One viewer at a time.
- Video is encrypted by WebRTC (DTLS-SRTP). The pairing page is plain HTTP on your LAN; see [docs/SECURITY_NOTES.md](docs/SECURITY_NOTES.md) for what that means.

## Limitations (v0.1)

- View only: no mouse or keyboard from the viewer yet.
- Primary display only. No audio.
- Windows can't capture the UAC "secure desktop": while an admin prompt is open the viewer freezes. Answer it on the host.
- The host's own screen stays on (v0.6 adds a "host screen off" mode).

## Project layout

```
apps/host        Electron app: capture, WebRTC sender, LAN server, pairing, UI, tray
apps/viewer      Static page served by the host (ES2020, works in Chrome 109)
packages/protocol  Typed messages, SHA-256 and PIN proof, shared by both
docs/            Overview, architecture, decisions, connection guides, journal (specs live in `.claude/specs/`)
```

## Development

```bash
pnpm build   # compile everything
pnpm test    # build, then run the unit tests (node:test)
pnpm clean   # remove build output
```

Read [CLAUDE.md](CLAUDE.md) for coding rules (including the dependency policy) and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## License

[MIT](LICENSE) © 2026 Rafi Uzzaman
