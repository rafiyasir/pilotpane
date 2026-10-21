/**
 * Capture engine. Runs in a hidden window because screen capture and
 * WebRTC live in Chromium, not in Node. Commands come from the main process;
 * signaling goes back to it and from there to the viewer over the WebSocket.
 */
import type { EngineCommand, EngineEvent, IceCandidate, QualityPreset } from '/protocol/index.js';
import { QUALITY_SPECS } from '/protocol/index.js';
import { api } from '../shared/ui.js';

let pc: RTCPeerConnection | null = null;
let stream: MediaStream | null = null;
let sender: RTCRtpSender | null = null;
let quality: QualityPreset = '1080p';
let pendingIce: RTCIceCandidateInit[] = [];

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
        maxFrameRate: 30
      }
    }
  };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints as unknown as MediaStreamConstraints);
  } catch (first) {
    console.warn('[engine] desktop getUserMedia failed, trying getDisplayMedia', first);
    return navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: { width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 30 } }
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
  enc.maxBitrate = spec.maxBitrate;
  enc.maxFramerate = 30;
  // Keep text sharp: under pressure, drop frames before dropping resolution.
  (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = 'maintain-resolution';
  await sender.setParameters(params);
}

function stop(): void {
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
  track.contentHint = 'text';
  track.addEventListener('ended', () => emit({ evt: 'error', message: 'Screen capture ended.' }));

  const peer = new RTCPeerConnection({ iceServers: [] }); // LAN only: no STUN, no TURN
  pc = peer;
  const transceiver = peer.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
  sender = transceiver.sender;
  preferH264(transceiver);

  peer.addEventListener('icecandidate', (e) =>
    emit({ evt: 'ice', candidate: e.candidate ? toWire(e.candidate) : null })
  );
  peer.addEventListener('connectionstatechange', () => emit({ evt: 'connection', state: peer.connectionState }));

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
      await pc.setRemoteDescription({ type: 'answer', sdp: command.sdp });
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
