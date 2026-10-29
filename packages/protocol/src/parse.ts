import { isQualityPreset } from './constants.js';
import type { HostMessage, IceCandidate, StreamStats, ViewerMessage } from './messages.js';

/** Largest message either side accepts. SDP offers are a few KB. */
export const MAX_MESSAGE_BYTES = 64 * 1024;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = MAX_MESSAGE_BYTES): v is string => typeof v === 'string' && v.length <= max;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);
const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v, 256);

function parseJson(raw: string): Obj | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return isObj(v) ? v : null;
  } catch {
    return null;
  }
}

function parseIce(v: unknown): IceCandidate | null | undefined {
  if (v === null) return null;
  if (!isObj(v)) return undefined;
  if (!isStr(v.candidate, 1024) || !isStrOrNull(v.sdpMid) || !isNumOrNull(v.sdpMLineIndex)) return undefined;
  return { candidate: v.candidate, sdpMid: v.sdpMid, sdpMLineIndex: v.sdpMLineIndex };
}

function parseStats(v: unknown): StreamStats | undefined {
  if (!isObj(v)) return undefined;
  const { fps, kbps, rttMs, width, height, codec, lossPct } = v;
  if (!isNum(fps) || !isNum(kbps) || !isNumOrNull(rttMs) || !isNum(width) || !isNum(height)) return undefined;
  if (!isStr(codec, 64) || !isNum(lossPct)) return undefined;
  return { fps, kbps, rttMs, width, height, codec, lossPct };
}

/** Returns a typed message, or null if the text is not a valid viewer message. */
export function parseViewerMessage(raw: string): ViewerMessage | null {
  const m = parseJson(raw);
  if (!m) return null;
  switch (m.type) {
    case 'pair':
      return isStr(m.proof, 128) ? { type: 'pair', proof: m.proof } : null;
    case 'resume':
      return isStr(m.token, 128) ? { type: 'resume', token: m.token } : null;
    case 'answer':
      return isStr(m.sdp) ? { type: 'answer', sdp: m.sdp } : null;
    case 'ice': {
      const c = parseIce(m.candidate);
      return c === undefined ? null : { type: 'ice', candidate: c };
    }
    case 'set-quality':
      return isQualityPreset(m.preset) ? { type: 'set-quality', preset: m.preset } : null;
    case 'stats': {
      const s = parseStats(m.stats);
      return s ? { type: 'stats', stats: s } : null;
    }
    case 'leave':
      return { type: 'leave' };
    default:
      return null;
  }
}

/** Returns a typed message, or null if the text is not a valid host message. */
export function parseHostMessage(raw: string): HostMessage | null {
  const m = parseJson(raw);
  if (!m) return null;
  switch (m.type) {
    case 'hello':
      return isNum(m.protocol) && isStr(m.hostName, 256) && isStr(m.nonce, 128) && isStr(m.appVersion, 32)
        ? { type: 'hello', protocol: m.protocol, hostName: m.hostName, nonce: m.nonce, appVersion: m.appVersion }
        : null;
    case 'paired':
      return isStr(m.token, 128) ? { type: 'paired', token: m.token } : null;
    case 'pair-failed': {
      const r = m.reason;
      if (r !== 'wrong-pin' && r !== 'locked' && r !== 'bad-token') return null;
      return isNum(m.attemptsLeft) && isNum(m.retryAfterSec)
        ? { type: 'pair-failed', reason: r, attemptsLeft: m.attemptsLeft, retryAfterSec: m.retryAfterSec }
        : null;
    }
    case 'busy':
      return { type: 'busy' };
    case 'offer':
      return isStr(m.sdp) ? { type: 'offer', sdp: m.sdp } : null;
    case 'ice': {
      const c = parseIce(m.candidate);
      return c === undefined ? null : { type: 'ice', candidate: c };
    }
    case 'quality':
      return isQualityPreset(m.preset) ? { type: 'quality', preset: m.preset } : null;
    case 'input-state':
      return typeof m.available === 'boolean' ? { type: 'input-state', available: m.available } : null;
    case 'bye': {
      const r = m.reason;
      return r === 'host-stopped' || r === 'kicked' || r === 'new-pin' || r === 'capture-failed' || r === 'paused'
        ? { type: 'bye', reason: r }
        : null;
    }
    default:
      return null;
  }
}
