import type { CodecCapabilities } from '/protocol/index.js';

/** Asks about one codec family; resolves true (smooth), false (not smooth) or null (cannot say). */
export type CodecProbe = (family: string) => Promise<boolean | null>;

const CONTENT_TYPES: Record<string, string> = {
  vp8: 'video/VP8',
  h264: 'video/H264;profile-level-id=42e01f'
};

const PROBE_TIMEOUT_MS = 1000;

/** The real probe: navigator.mediaCapabilities for 1080p at 30 fps. Any failure means "cannot say". */
export const browserProbe: CodecProbe = async (family) => {
  const contentType = CONTENT_TYPES[family];
  const mc = (navigator as Navigator & { mediaCapabilities?: MediaCapabilities }).mediaCapabilities;
  if (!contentType || !mc || typeof mc.decodingInfo !== 'function') return null;
  try {
    const info = await mc.decodingInfo({
      type: 'webrtc',
      video: { contentType, width: 1920, height: 1080, framerate: 30, bitrate: 8_000_000 }
    } as MediaDecodingConfiguration);
    return info.supported && info.smooth;
  } catch {
    return null;
  }
};

/** Probes VP8 and H.264 together; a probe that is slow or throws counts as unknown. */
export async function probeCodecs(
  probe: CodecProbe = browserProbe,
  timeoutMs = PROBE_TIMEOUT_MS
): Promise<CodecCapabilities> {
  const safe = (family: string): Promise<boolean | null> =>
    Promise.race([
      probe(family).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]);
  const [vp8, h264] = await Promise.all([safe('vp8'), safe('h264')]);
  return { vp8, h264 };
}
