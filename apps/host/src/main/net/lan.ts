import { networkInterfaces } from 'node:os';
import type { LanAddress, NetKind } from '@pilotpane/protocol';

/** True for IPv4 addresses that only exist on local networks. */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) // link-local: direct Ethernet cable with no DHCP
  );
}

/** Guesses the connection type from the Windows adapter name and address. */
export function classify(iface: string, address: string): NetKind {
  const n = iface.toLowerCase();
  if (address.startsWith('127.')) return 'loopback';
  if (/vethernet|virtualbox|vmware|hyper-v|wsl|docker|vpn|tap|tun/.test(n)) return 'virtual';
  if (n.includes('bluetooth')) return 'bluetooth';
  if (address.startsWith('192.168.137.')) return 'hotspot'; // Windows Mobile hotspot range
  if (n.includes('wi-fi') || n.includes('wifi') || n.includes('wireless') || n.includes('wlan')) return 'wifi';
  if (n.includes('ethernet') || n.includes('local area connection')) return 'ethernet';
  return 'other';
}

const RANK: Record<NetKind, number> = {
  ethernet: 0,
  hotspot: 1,
  wifi: 2,
  other: 3,
  bluetooth: 4,
  virtual: 5,
  loopback: 6
};

/** Private IPv4 addresses of this machine, best first. */
export function listLanAddresses(): LanAddress[] {
  const out: LanAddress[] = [];
  for (const [iface, infos] of Object.entries(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue;
      if (!isPrivateIPv4(info.address)) continue;
      out.push({ iface, address: info.address, kind: classify(iface, info.address) });
    }
  }
  return out.sort((x, y) => RANK[x.kind] - RANK[y.kind] || x.address.localeCompare(y.address));
}

/** Turns "::ffff:192.168.1.20" into "192.168.1.20". */
export function plainIPv4(remote: string | undefined): string {
  if (!remote) return 'unknown';
  return remote.startsWith('::ffff:') ? remote.slice(7) : remote;
}
