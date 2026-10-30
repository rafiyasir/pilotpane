/**
 * Types used only inside the host app: between the Electron main process,
 * the host window, the PIN window and the hidden capture "engine" window.
 * They never travel over the network.
 */
import type { QualityPreset, ThemeName } from './constants.js';
import type { InputMessage } from './input.js';
import type { IceCandidate, StreamStats } from './messages.js';

export type NetKind = 'ethernet' | 'wifi' | 'hotspot' | 'bluetooth' | 'loopback' | 'virtual' | 'other';

export interface LanAddress {
  iface: string;
  address: string;
  kind: NetKind;
}

export type HostStatus =
  'starting' | 'ready' | 'connecting' | 'streaming' | 'paused' | 'no-network' | 'port-busy' | 'error';

export type UpdateFailure =
  'offline' | 'bad-manifest' | 'bad-signature' | 'bad-download' | 'download-failed' | 'install-failed';

/** Where "Check for updates" is. Nothing leaves `idle` unless the user clicks. */
export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'up-to-date' }
  | { phase: 'available'; version: string; notes: string[] }
  | { phase: 'downloading'; version: string; receivedBytes: number; totalBytes: number }
  | { phase: 'verifying'; version: string }
  | { phase: 'ready'; version: string }
  | { phase: 'failed'; reason: UpdateFailure };

export interface HostState {
  status: HostStatus;
  appVersion: string;
  hostName: string;
  pin: string;
  port: number;
  /** Addresses a viewer can use, best first. Loopback is excluded. */
  addresses: LanAddress[];
  theme: ThemeName;
  quality: QualityPreset;
  viewer: { address: string; browser: string; since: number } | null;
  stats: StreamStats | null;
  lockedUntil: number | null;
  message: string | null;
  update: UpdateState;
  /** The first window close was held and the "keeps running" card is showing. */
  closeNotice: boolean;
}

/** Main process -> engine window. */
export type EngineCommand =
  | { cmd: 'start'; sourceId: string; quality: QualityPreset }
  | { cmd: 'answer'; sdp: string }
  | { cmd: 'ice'; candidate: IceCandidate | null }
  | { cmd: 'quality'; preset: QualityPreset }
  | { cmd: 'load-level'; level: LoadLevel }
  | { cmd: 'stop' };

/** How far the host has stepped the stream down because its CPU is busy: 0 none, 2 most. */
export type LoadLevel = 0 | 1 | 2;

/** Engine window -> main process. */
export type EngineEvent =
  | { evt: 'offer'; sdp: string }
  | { evt: 'ice'; candidate: IceCandidate | null }
  | { evt: 'connection'; state: string }
  | { evt: 'stopped' }
  | { evt: 'input'; msg: InputMessage }
  | {
      evt: 'debug-stats';
      frameWidth: number;
      framesPerSecond: number;
      targetBitrate: number;
      qualityLimitationReason: string;
      encoderImplementation: string;
      powerEfficientEncoder: boolean;
      /** Seconds the encoder has been limited by the CPU since the stream began. */
      cpuLimitedSec: number;
    }
  | { evt: 'error'; message: string };

/** Host window and PIN window -> main process. */
export type HostAction =
  | { action: 'new-pin' }
  | { action: 'disconnect-viewer' }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'show-pin-screen' }
  | { action: 'hide-pin-screen' }
  | { action: 'set-theme'; theme: ThemeName }
  | { action: 'use-next-port' }
  | { action: 'check-for-updates' }
  | { action: 'download-update' }
  | { action: 'install-update' }
  | { action: 'dismiss-update' }
  | { action: 'keep-in-tray' }
  | { action: 'quit' };

/** What the preload script exposes as window.pilotpane. */
export interface PilotpaneBridge {
  getState(): Promise<HostState>;
  onState(cb: (state: HostState) => void): void;
  act(action: HostAction): void;
  onEngineCommand(cb: (command: EngineCommand) => void): void;
  sendEngineEvent(event: EngineEvent): void;
}
