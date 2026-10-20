import type { QualityPreset } from './constants.js';

/** Same shape as RTCIceCandidateInit, kept here so Node code needs no DOM types. */
export interface IceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface StreamStats {
  fps: number;
  kbps: number;
  rttMs: number | null;
  width: number;
  height: number;
  codec: string;
  lossPct: number;
}

// ---------- Host -> viewer (over the WebSocket) ----------

export type HostMessage =
  | { type: 'hello'; protocol: number; hostName: string; nonce: string; appVersion: string }
  | { type: 'paired'; token: string }
  | { type: 'pair-failed'; reason: 'wrong-pin' | 'locked' | 'bad-token'; attemptsLeft: number; retryAfterSec: number }
  | { type: 'busy' }
  | { type: 'offer'; sdp: string }
  | { type: 'ice'; candidate: IceCandidate | null }
  | { type: 'quality'; preset: QualityPreset }
  | { type: 'bye'; reason: 'host-stopped' | 'kicked' | 'new-pin' | 'capture-failed' };

// ---------- Viewer -> host (over the WebSocket) ----------

export type ViewerMessage =
  | { type: 'pair'; proof: string }
  | { type: 'resume'; token: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: IceCandidate | null }
  | { type: 'set-quality'; preset: QualityPreset }
  | { type: 'stats'; stats: StreamStats }
  | { type: 'leave' };

export type HostMessageType = HostMessage['type'];
export type ViewerMessageType = ViewerMessage['type'];
