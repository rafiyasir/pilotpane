import type { IceCandidate, InputMessage, StreamStats } from '/protocol/index.js';
import { INPUT_CHANNEL_LABEL } from '/protocol/index.js';

/**
 * The receiving side of the WebRTC connection. The host makes the offer;
 * this answers it and shows the incoming video.
 */
export class Receiver {
  private pc: RTCPeerConnection | null = null;
  private input: RTCDataChannel | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private prev: { bytes: number; frames: number; at: number } | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly hooks: {
      sendAnswer(sdp: string): void;
      sendIce(candidate: IceCandidate | null): void;
      onConnected(): void;
      onFailed(): void;
    }
  ) {}

  async handleOffer(sdp: string): Promise<void> {
    this.close();
    const pc = new RTCPeerConnection({ iceServers: [] }); // LAN only
    this.pc = pc;

    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      if (this.video.srcObject !== stream) {
        this.video.srcObject = stream;
        this.video.play().catch(() => {
          /* autoplay of muted video is allowed; ignore */
        });
      }
    };
    // The host opens the input channel; the viewer only sends on it.
    pc.ondatachannel = (e) => {
      if (pc === this.pc && e.channel.label === INPUT_CHANNEL_LABEL) this.input = e.channel;
    };
    pc.onicecandidate = (e) => {
      const c = e.candidate;
      this.hooks.sendIce(c ? { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex } : null);
    };
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      if (pc.connectionState === 'connected') this.hooks.onConnected();
      if (pc.connectionState === 'failed') this.hooks.onFailed();
    };

    await pc.setRemoteDescription({ type: 'offer', sdp });
    for (const c of this.pendingIce) await pc.addIceCandidate(c);
    this.pendingIce = [];
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.hooks.sendAnswer(pc.localDescription?.sdp ?? answer.sdp ?? '');
  }

  async addIce(candidate: IceCandidate | null): Promise<void> {
    if (!candidate) return;
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(candidate);
  }

  /** True when the host's input channel is open. */
  get inputOpen(): boolean {
    return this.input?.readyState === 'open';
  }

  /**
   * Sends one input message. A mouse move is skipped while the channel is
   * backed up (the next one replaces it anyway). Returns false if not sent.
   */
  sendInput(msg: InputMessage): boolean {
    const ch = this.input;
    if (!ch || ch.readyState !== 'open') return false;
    if (msg.type === 'mouse-move' && ch.bufferedAmount > 16 * 1024) return false;
    ch.send(JSON.stringify(msg));
    return true;
  }

  /** Closes the connection but leaves the last frame on screen. */
  close(): void {
    this.input = null;
    if (this.pc) {
      this.pc.ondatachannel = null;
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
    }
    this.pc = null;
    this.pendingIce = [];
    this.prev = null;
  }

  async stats(): Promise<StreamStats | null> {
    const pc = this.pc;
    if (!pc) return null;
    const report = await pc.getStats();
    let inbound: Record<string, unknown> | null = null;
    let pairId: string | null = null;
    const byId = new Map<string, Record<string, unknown>>();

    report.forEach((r: Record<string, unknown>) => {
      byId.set(String(r.id), r);
      if (r.type === 'inbound-rtp' && r.kind === 'video') inbound = r;
      if (r.type === 'transport' && typeof r.selectedCandidatePairId === 'string') pairId = r.selectedCandidatePairId;
    });
    const inb = inbound as Record<string, unknown> | null;
    if (!inb) return null;

    const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
    const now = performance.now();
    const bytes = num(inb.bytesReceived);
    const frames = num(inb.framesDecoded);
    let kbps = 0;
    let fps = num(inb.framesPerSecond);
    if (this.prev) {
      const secs = (now - this.prev.at) / 1000;
      if (secs > 0) {
        kbps = ((bytes - this.prev.bytes) * 8) / 1000 / secs;
        if (!fps) fps = (frames - this.prev.frames) / secs;
      }
    }
    this.prev = { bytes, frames, at: now };

    const pair = pairId ? byId.get(pairId) : undefined;
    const rtt = pair && typeof pair.currentRoundTripTime === 'number' ? pair.currentRoundTripTime * 1000 : null;
    const codecReport = typeof inb.codecId === 'string' ? byId.get(inb.codecId) : undefined;
    const codec = typeof codecReport?.mimeType === 'string' ? codecReport.mimeType.replace('video/', '') : '-';
    const lost = num(inb.packetsLost);
    const received = num(inb.packetsReceived);

    return {
      fps,
      kbps,
      rttMs: rtt,
      width: num(inb.frameWidth),
      height: num(inb.frameHeight),
      codec,
      lossPct: lost + received > 0 ? (lost / (lost + received)) * 100 : 0
    };
  }
}
