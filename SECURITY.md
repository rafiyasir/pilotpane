# Security policy

PilotPane shares a screen (and later mouse and keyboard) over a local network, so security reports are very welcome.

## Reporting

Please **don't open a public issue** for a vulnerability. Use GitHub's private vulnerability reporting ("Report a vulnerability" under the Security tab of this repository). You'll get a reply within a week.

## Scope

In scope: anything that lets someone on the same network see or control the host without the PIN, read the PIN, crash the host remotely, or reach PilotPane from outside the LAN.

Out of scope: attacks that need prior access to the host machine, and using PilotPane on untrusted shared networks (documented as unsupported).

The design and its known limits are described in [docs/SECURITY_NOTES.md](docs/SECURITY_NOTES.md).
