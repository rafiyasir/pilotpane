import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_PORT, isQualityPreset, isThemeName, type QualityPreset, type ThemeName } from '@pilotpane/protocol';
import { createLogger } from './log.js';

const log = createLogger('settings');

export interface Settings {
  port: number;
  theme: ThemeName;
  quality: QualityPreset;
}

export const DEFAULT_SETTINGS: Settings = { port: DEFAULT_PORT, theme: 'cockpit', quality: '1080p' };

/** Reads settings.json, falling back to defaults for anything missing or invalid. */
export function loadSettings(file: string): Settings {
  try {
    const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const port = typeof s.port === 'number' && Number.isInteger(s.port) && s.port >= 1024 && s.port <= 65535 ? s.port : DEFAULT_SETTINGS.port;
    return {
      port,
      theme: isThemeName(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
      quality: isQualityPreset(s.quality) ? s.quality : DEFAULT_SETTINGS.quality
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(file: string, settings: Settings): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(settings, null, 2));
  } catch (err) {
    log.warn('could not save settings', err);
  }
}

/** "--port 7500" on the command line wins over the saved port. */
export function portFromArgs(argv: string[]): number | null {
  const i = argv.indexOf('--port');
  const value = i >= 0 ? Number(argv[i + 1]) : NaN;
  return Number.isInteger(value) && value >= 1024 && value <= 65535 ? value : null;
}
