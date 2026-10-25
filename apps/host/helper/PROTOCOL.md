# pilotpane-input stdin protocol

The host starts `pilotpane-input.exe` and writes one ASCII command per line (`\n`) to its stdin.
Nothing here is network-facing: it is a private pipe between the host and its child process.

On start the helper prints `ready` on stdout. Commands sent before that are lost.

| Line      | Meaning                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `M x y`   | Move the cursor to an absolute position, `x` and `y` in 0..65535 on the primary screen |
| `B b d`   | Mouse button `b` (`L`, `R`, `M`), `d` is `1` for down and `0` for up                   |
| `W dx dy` | Scroll `dx` and `dy` notches, each in -100..100 (positive `dy` scrolls up)             |
| `K vk d`  | Key with Windows virtual-key code `vk` (1..254), `d` is `1` for down and `0` for up    |

Rules:

- A malformed or out-of-range line is ignored and reported on stderr (`ignored: ...`). The helper never exits because of one.
- When stdin closes, the helper releases every button and key still held, then exits.
- Windows does not allow injecting input into the UAC secure desktop or into windows of higher integrity than the helper.
