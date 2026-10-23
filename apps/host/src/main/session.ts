/**
 * Talks to viewers over WebSocket: hello, pairing, and relaying WebRTC
 * signaling between the one active viewer and the capture engine.
 */
import {
  PROTOCOL_VERSION,
  parseViewerMessage,
  type HostMessage,
  type IceCandidate,
  type QualityPreset,
  type StreamStats
} from '@pilotpane/protocol';
import { createLogger } from './log.js';
import type { ClientInfo } from './net/http-server.js';
import { CLOSE, type WebSocketConnection } from './net/ws.js';
import type { Pairing } from './pairing.js';

const log = createLogger('session');

export interface ViewerInfo {
  address: string;
  browser: string;
  since: number;
}

export interface SessionHooks {
  hostName: string;
  appVersion: string;
  onPaired(viewer: ViewerInfo): void;
  onViewerGone(): void;
  onAnswer(sdp: string): void;
  onIce(candidate: IceCandidate | null): void;
  onQuality(preset: QualityPreset): void;
  onStats(stats: StreamStats): void;
  onLockChange(): void;
}

/** "Chrome 109 on Windows 8" from a user agent, good enough for a label. */
const WINDOWS_NT: Record<string, string> = {
  '6.1': 'Windows 7',
  '6.2': 'Windows 8',
  '6.3': 'Windows 8.1',
  '10.0': 'Windows 10/11'
};

export function describeBrowser(ua: string): string {
  const pick = (re: RegExp): string | undefined => re.exec(ua)?.[1];
  const edge = pick(/Edg\/(\d+)/);
  const firefox = pick(/Firefox\/(\d+)/);
  const chrome = pick(/Chrome\/(\d+)/);
  const browser = edge ? `Edge ${edge}` : firefox ? `Firefox ${firefox}` : chrome ? `Chrome ${chrome}` : 'Browser';

  const nt = pick(/Windows NT (\d+\.\d+)/);
  let os = 'unknown OS';
  if (nt) os = WINDOWS_NT[nt] ?? 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('CrOS')) os = 'ChromeOS';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  return `${browser} on ${os}`;
}

export class ViewerSessions {
  private active: { conn: WebSocketConnection; info: ViewerInfo } | null = null;

  constructor(
    private readonly pairing: Pairing,
    private readonly hooks: SessionHooks
  ) {}

  get hasViewer(): boolean {
    return this.active !== null;
  }

  /** Called for every new WebSocket from the HTTP server. */
  accept(conn: WebSocketConnection, client: ClientInfo): void {
    const nonce = this.pairing.newNonce();
    log.info(`viewer socket from ${client.remoteAddress}`);
    this.send(conn, {
      type: 'hello',
      protocol: PROTOCOL_VERSION,
      hostName: this.hooks.hostName,
      nonce,
      appVersion: this.hooks.appVersion
    });

    conn.on('message', (text: string) => {
      const msg = parseViewerMessage(text);
      if (!msg) {
        log.warn(`bad message from ${client.remoteAddress}, closing`);
        conn.close(CLOSE.POLICY, 'bad message');
        return;
      }
      const isActive = this.active?.conn === conn;

      switch (msg.type) {
        case 'pair': {
          const result = this.pairing.verify(nonce, msg.proof);
          if (result.ok) {
            this.promote(conn, client, result.token);
          } else {
            log.warn(`wrong PIN from ${client.remoteAddress} (${result.reason})`);
            this.send(conn, {
              type: 'pair-failed',
              reason: result.reason,
              attemptsLeft: result.attemptsLeft,
              retryAfterSec: result.retryAfterSec
            });
            this.hooks.onLockChange();
          }
          return;
        }
        case 'resume':
          if (this.pairing.resume(msg.token)) this.promote(conn, client, msg.token);
          else this.send(conn, { type: 'pair-failed', reason: 'bad-token', attemptsLeft: 0, retryAfterSec: 0 });
          return;
        case 'answer':
          if (isActive) this.hooks.onAnswer(msg.sdp);
          return;
        case 'ice':
          if (isActive) this.hooks.onIce(msg.candidate);
          return;
        case 'set-quality':
          if (isActive) this.hooks.onQuality(msg.preset);
          return;
        case 'stats':
          if (isActive) this.hooks.onStats(msg.stats);
          return;
        case 'leave':
          conn.close(CLOSE.NORMAL, 'viewer left');
          return;
      }
    });

    conn.on('close', () => {
      if (this.active?.conn === conn) {
        log.info(`viewer ${client.remoteAddress} disconnected`);
        this.active = null;
        this.hooks.onViewerGone();
      }
    });
  }

  /** Sends a message to the active viewer, if any. */
  toViewer(msg: HostMessage): void {
    if (this.active) this.send(this.active.conn, msg);
  }

  /** Disconnects the active viewer with a reason it can show. */
  kick(reason: 'host-stopped' | 'kicked' | 'new-pin' | 'capture-failed'): void {
    const current = this.active;
    if (!current) return;
    this.send(current.conn, { type: 'bye', reason });
    current.conn.close(CLOSE.NORMAL, reason);
  }

  /**
   * Closes the active viewer's socket like a network drop, with no `bye`, so the
   * viewer keeps its token and retries (used when the host goes to sleep).
   */
  dropActive(reason: string): void {
    this.active?.conn.close(CLOSE.GOING_AWAY, reason);
  }

  private promote(conn: WebSocketConnection, client: ClientInfo, token: string): void {
    const current = this.active;
    if (current && current.conn !== conn) {
      if (current.info.address === client.remoteAddress) {
        // Same machine reconnecting while the old socket hasn't timed out yet.
        log.info('replacing stale socket from the same viewer');
        this.active = null;
        current.conn.close(CLOSE.GOING_AWAY, 'replaced');
        this.hooks.onViewerGone();
      } else {
        this.send(conn, { type: 'busy' });
        conn.close(CLOSE.NORMAL, 'busy');
        return;
      }
    }
    const info: ViewerInfo = {
      address: client.remoteAddress,
      browser: describeBrowser(client.userAgent),
      since: Date.now()
    };
    this.active = { conn, info };
    this.send(conn, { type: 'paired', token });
    log.info(`paired with ${info.address} (${info.browser})`);
    this.hooks.onPaired(info);
  }

  private send(conn: WebSocketConnection, msg: HostMessage): void {
    conn.send(JSON.stringify(msg));
  }
}
