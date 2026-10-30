/**
 * Capture engine. Runs in a hidden window because screen capture and
 * WebRTC live in Chromium, not in Node. Commands come from the main process;
 * signaling goes back to it and from there to the viewer over the WebSocket.
 */
import type { EngineCommand, EngineEvent, IceCandidate, LoadLevel, QualityPreset } from '/protocol/index.js';
import { INPUT_CHANNEL_LABEL, QUALITY_SPECS, parseInputMessage, withBitrateHints } from '/protocol/index.js';
import { api } from '../shared/ui.js';

let pc: RTCPeerConnection | null = null;
let stream: MediaStream | null = null;
let sender: RTCRtpSender | null = null;
let quality: QualityPreset = '1080p';
let loadLevel: LoadLevel = 0;
let pendingIce: RTCIceCandidateInit[] = [];
let statsTimer: number | undefined;

const STATS_INTERVAL_MS = 5000;

/** Ceiling per load level (see HostLoadGovernor): a busy host sends fewer, smaller frames instead of stalling. */
const LOAD_MAX_FPS = [60, 30, 20] as const;
const LOAD_MAX_HEIGHT = [1080, 1080, 720] as const;

const emit = (e: EngineEvent): void => api.sendEngineEvent(e);

function toWire(c: RTCIceCandidate): IceCandidate {
  return { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex };
}

/**
 * Electron desktop capture. First the classic route (the source id comes from
 * desktopCapturer in main); if this Chromium refuses it, fall back to
 * getDisplayMedia, which main answers with the same screen.
 */
async function capture(sourceId: string): Promise<MediaStream> {
  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 60
      }
    }
  };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints as unknown as MediaStreamConstraints);
  } catch (first) {
    console.warn('[engine] desktop getUserMedia failed, trying getDisplayMedia', first);
    return navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 60 } }
    });
  }
}

/**
 * Codec order for the offer: VP8, then H.264, then the rest (ADR-019). The hardware H.264 encoder
 * spent too few bits on a full-screen scroll and left it blurry for seconds; software VP8 with the
 * `detail` hint stays sharp and smoother, and costs a few percent of CPU.
 */
function preferCodecs(transceiver: RTCRtpTransceiver): void {
  const caps = RTCRtpSender.getCapabilities('video');
  if (!caps) return;
  const rank = (c: RTCRtpCodec): number => {
    const mime = c.mimeType.toLowerCase();
    return mime === 'video/vp8' ? 0 : mime === 'video/h264' ? 1 : 2;
  };
  transceiver.setCodecPreferences([...caps.codecs].sort((a, b) => rank(a) - rank(b)));
}

/** Applies the preset: scale down from the captured size and cap the bitrate. */
async function applyQuality(): Promise<void> {
  const track = stream?.getVideoTracks()[0];
  if (!sender || !track) return;
  const spec = QUALITY_SPECS[quality];
  const capturedHeight = track.getSettings().height ?? spec.height;
  const height = Math.min(spec.height, LOAD_MAX_HEIGHT[loadLevel]);
  const params = sender.getParameters();
  if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
  const enc = params.encodings[0]!;
  enc.scaleResolutionDownBy = Math.max(1, capturedHeight / height);
  // Only the cap can change on a live connection. The min and start hints in
  // the SDP (withBitrateHints) are read once at connect, so a quality change
  // after that moves the ceiling and the scale, not the floor.
  enc.maxBitrate = spec.maxBitrate;
  enc.maxFramerate = Math.min(spec.maxFramerate, LOAD_MAX_FPS[loadLevel]);
  // Keep text sharp: under pressure, drop frames before dropping resolution.
  (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = 'maintain-resolution';
  await sender.setParameters(params);
}

/** Every few seconds, reports what the encoder is really doing (main logs it in debug mode). */
function startStatsReports(): void {
  window.clearInterval(statsTimer);
  statsTimer = window.setInterval(() => {
    void sender?.getStats().then((report) => {
      report.forEach((s: Record<string, unknown>) => {
        if (s.type !== 'outbound-rtp' || s.kind !== 'video') return;
        const durations = (s.qualityLimitationDurations ?? {}) as Record<string, unknown>;
        emit({
          evt: 'debug-stats',
          frameWidth: Number(s.frameWidth ?? 0),
          framesPerSecond: Number(s.framesPerSecond ?? 0),
          targetBitrate: Number(s.targetBitrate ?? 0),
          qualityLimitationReason: String(s.qualityLimitationReason ?? 'none'),
          encoderImplementation: String(s.encoderImplementation ?? 'unknown'),
          powerEfficientEncoder: s.powerEfficientEncoder === true,
          cpuLimitedSec: Number(durations.cpu ?? 0)
        });
      });
    });
  }, STATS_INTERVAL_MS);
}

function stop(): void {
  window.clearInterval(statsTimer);
  pc?.close();
  stream?.getTracks().forEach((t) => t.stop());
  pc = null;
  stream = null;
  sender = null;
  pendingIce = [];
}

async function start(sourceId: string, preset: QualityPreset): Promise<void> {
  stop();
  quality = preset;
  loadLevel = 0;
  stream = await capture(sourceId);
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error('screen capture returned no video');
  // 'detail' keeps text sharp while scrolling. 'motion' (ADR-016) favoured smooth frames and left
  // scrolling blurry; 'text' sent too few frames (ADR-019). Resolution is also kept by degradationPreference.
  track.contentHint = 'detail';
  track.addEventListener('ended', () => emit({ evt: 'error', message: 'Screen capture ended.' }));

  const peer = new RTCPeerConnection({ iceServers: [] }); // LAN only: no STUN, no TURN
  pc = peer;
  const transceiver = peer.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
  sender = transceiver.sender;
  preferCodecs(transceiver);

  // Created before the offer so the viewer receives it. Only the viewer's mouse goes this way.
  const inputChannel = peer.createDataChannel(INPUT_CHANNEL_LABEL, { ordered: true });
  inputChannel.addEventListener('message', (e: MessageEvent<unknown>) => {
    const msg = parseInputMessage(e.data);
    if (msg) emit({ evt: 'input', msg });
  });

  peer.addEventListener('icecandidate', (e) =>
    emit({ evt: 'ice', candidate: e.candidate ? toWire(e.candidate) : null })
  );
  peer.addEventListener('connectionstatechange', () => {
    emit({ evt: 'connection', state: peer.connectionState });
    if (peer.connectionState === 'connected') startStatsReports();
  });

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  emit({ evt: 'offer', sdp: peer.localDescription?.sdp ?? offer.sdp ?? '' });
}

async function handle(command: EngineCommand): Promise<void> {
  switch (command.cmd) {
    case 'start':
      await start(command.sourceId, command.quality);
      return;
    case 'answer':
      if (!pc) return;
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: withBitrateHints(command.sdp, QUALITY_SPECS[quality])
      });
      for (const c of pendingIce) await pc.addIceCandidate(c);
      pendingIce = [];
      await applyQuality();
      return;
    case 'ice':
      if (!pc || !command.candidate) return;
      if (!pc.remoteDescription) pendingIce.push(command.candidate);
      else await pc.addIceCandidate(command.candidate);
      return;
    case 'quality':
      quality = command.preset;
      await applyQuality();
      return;
    case 'load-level':
      loadLevel = command.level;
      await applyQuality();
      return;
    case 'stop':
      stop();
      emit({ evt: 'stopped' });
      return;
  }
}

// Run commands one at a time, in order.
let queue: Promise<void> = Promise.resolve();
api.onEngineCommand((command) => {
  queue = queue
    .then(() => handle(command))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      emit({ evt: 'error', message: `Capture failed: ${message}` });
    });
});
