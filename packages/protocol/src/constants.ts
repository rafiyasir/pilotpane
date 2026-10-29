/** Bumped when a message shape changes in a way old peers can't read. */
export const PROTOCOL_VERSION = 3;

/** Default HTTP + WebSocket port on the host. */
export const DEFAULT_PORT = 7420;

/** Path of the WebSocket endpoint on the host. */
export const WS_PATH = '/ws';

/** Wrong PIN tries allowed before the host pauses pairing. */
export const MAX_PIN_ATTEMPTS = 5;

/** How long pairing stays paused after too many wrong PINs. */
export const PIN_LOCK_SECONDS = 60;

/** Number of digits in a pairing PIN. */
export const PIN_LENGTH = 6;

export const QUALITY_PRESETS = ['1080p', '720p', 'low'] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

/** Target height, frame rate cap and bitrate range (bits per second) for each preset. */
export interface QualitySpec {
  height: number;
  maxFramerate: number;
  minBitrate: number;
  startBitrate: number;
  maxBitrate: number;
}

export const QUALITY_SPECS: Record<QualityPreset, QualitySpec> = {
  '1080p': { height: 1080, maxFramerate: 60, minBitrate: 3_000_000, startBitrate: 6_000_000, maxBitrate: 12_000_000 },
  '720p': { height: 720, maxFramerate: 60, minBitrate: 1_500_000, startBitrate: 3_000_000, maxBitrate: 6_000_000 },
  // For very slow links such as Bluetooth PAN (about 1 to 2 Mbps in practice).
  low: { height: 480, maxFramerate: 15, minBitrate: 300_000, startBitrate: 600_000, maxBitrate: 1_000_000 }
};

export const THEMES = ['cockpit', 'daylight', 'midnight', 'contrast'] as const;
export type ThemeName = (typeof THEMES)[number];

export function isQualityPreset(v: unknown): v is QualityPreset {
  return typeof v === 'string' && (QUALITY_PRESETS as readonly string[]).includes(v);
}

export function isThemeName(v: unknown): v is ThemeName {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v);
}
