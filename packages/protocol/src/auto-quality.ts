import { QUALITY_PRESETS, type QualityPreset } from './constants.js';
import type { StreamStats } from './messages.js';

/** Loss at or above this (percent) counts as a struggling link. */
export const AUTO_BAD_LOSS_PCT = 3;
/** Round trip above this (ms) counts as a struggling link. */
export const AUTO_BAD_RTT_MS = 250;
/** Loss under this (percent) counts as a quiet link. */
export const AUTO_GOOD_LOSS_PCT = 0.5;
/** Round trip under this (ms) counts as a quiet link. */
export const AUTO_GOOD_RTT_MS = 120;
/** How long the link must struggle before stepping down. */
export const AUTO_DOWN_AFTER_MS = 6_000;
/** How long the link must stay quiet before stepping up. */
export const AUTO_UP_AFTER_MS = 30_000;
/** Minimum time between two changes, so the picture does not flap. */
export const AUTO_MIN_GAP_MS = 15_000;

/** What Auto remembers between samples. Start with `autoStart`. */
export interface AutoState {
  preset: QualityPreset;
  /** When the current run of bad samples began, or null. */
  badSince: number | null;
  /** When the current run of quiet samples began, or null. */
  goodSince: number | null;
  /** When the preset last changed (or Auto started). */
  changedAt: number;
}

export function autoStart(preset: QualityPreset, now: number): AutoState {
  return { preset, badSince: null, goodSince: null, changedAt: now };
}

/**
 * Feed one stats sample. Returns the new state; `state.preset` differs from the
 * input preset when Auto wants to change. Frame rate is not used: a still
 * desktop sends few frames on a perfectly good link.
 */
export function autoStep(state: AutoState, sample: StreamStats, now: number): AutoState {
  const bad = sample.lossPct >= AUTO_BAD_LOSS_PCT || (sample.rttMs !== null && sample.rttMs > AUTO_BAD_RTT_MS);
  const good = sample.lossPct < AUTO_GOOD_LOSS_PCT && (sample.rttMs === null || sample.rttMs < AUTO_GOOD_RTT_MS);
  const badSince = bad ? (state.badSince ?? now) : null;
  const goodSince = good ? (state.goodSince ?? now) : null;
  const next: AutoState = { ...state, badSince, goodSince };
  if (now - state.changedAt < AUTO_MIN_GAP_MS) return next;

  const index = QUALITY_PRESETS.indexOf(state.preset);
  if (badSince !== null && now - badSince >= AUTO_DOWN_AFTER_MS) {
    const lower = QUALITY_PRESETS[index + 1];
    if (lower) return { preset: lower, badSince: null, goodSince: null, changedAt: now };
  }
  if (goodSince !== null && now - goodSince >= AUTO_UP_AFTER_MS) {
    const higher = QUALITY_PRESETS[index - 1];
    if (higher) return { preset: higher, badSince: null, goodSince: null, changedAt: now };
  }
  return next;
}
