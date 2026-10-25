/**
 * Capture engine. Runs in a hidden window because screen capture and
 * WebRTC live in Chromium, not in Node. Commands come from the main process;
 * signaling goes back to it and from there to the viewer over the WebSocket.
 */
import type { EngineCommand, EngineEvent, IceCandidate, QualityPreset } from '/protocol/index.js';
import { INPUT_CHANNEL_LABEL, QUALITY_SPECS, parseInputMessage, withBitrateHints } from '/protocol/index.js';
import { api } from '../shared/ui.js';

let pc: RTCPeerConnection | null = null;
let stream: MediaStream | null = null;
let sender: RTCRtpSender | null = null;
let quality: QualityPreset = '1080p';
let pendingIce: RTCIceCandidateInit[] = [];
let statsTimer: number | undefined;

const STATS_INTERVAL_MS = 5000;

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

/** Puts H.264 first when available (hardware encoders and old decoders like it). */
function preferH264(transceiver: RTCRtpTransceiver): void {
  const caps = RTCRtpSender.getCapabilities('video');
  if (!caps) return;
  const isH264 = (c: RTCRtpCodec) => c.mimeType.toLowerCase() === 'video/h264';
  const h264 = caps.codecs.filter(isH264);
  if (h264.length === 0) return;
  transceiver.setCodecPreferences([...h264, ...caps.codecs.filter((c) => !isH264(c))]);
}

/** Applies the preset: scale down from the captured size and cap the bitrate. */
async function applyQuality(): Promise<void> {
  const track = stream?.getVideoTracks()[0];
  if (!sender || !track) return;
  const spec = QUALITY_SPECS[quality];
  const capturedHeight = track.getSettings().height ?? spec.height;
  const params = sender.getParameters();
  if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
  const enc = params.encodings[0]!;
  enc.scaleResolutionDownBy = Math.max(1, capturedHeight / spec.height);
  // Only the cap can change on a live connection. The min and start hints in
  // the SDP (withBitrateHints) are read once at connect, so a quality change
  // after that moves the ceiling and the scale, not the floor.
  enc.maxBitrate = spec.maxBitrate;
  enc.maxFramerate = spec.maxFramerate;
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
        emit({
          evt: 'debug-stats',
          frameWidth: Number(s.frameWidth ?? 0),
          framesPerSecond: Number(s.framesPerSecond ?? 0),
          targetBitrate: Number(s.targetBitrate ?? 0),
          qualityLimitationReason: String(s.qualityLimitationReason ?? 'none')
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
  stream = await capture(sourceId);
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error('screen capture returned no video');
  // 'text' makes Chrome favour still sharpness and send few frames, which made the pointer lag.
  // Resolution is still kept by degradationPreference, so text stays sharp.
  track.contentHint = 'motion';
  track.addEventListener('ended', () => emit({ evt: 'error', message: 'Screen capture ended.' }));

  const peer = new RTCPeerConnection({ iceServers: [] }); // LAN only: no STUN, no TURN
  pc = peer;
  const transceiver = peer.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
  sender = transceiver.sender;
  preferH264(transceiver);

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
