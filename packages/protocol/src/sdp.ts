/** Bitrate hints for the sender's encoder, in bits per second. */
export interface BitrateHints {
  minBitrate: number;
  startBitrate: number;
  maxBitrate: number;
}

const CODECS = new Set(['vp8', 'vp9', 'h264', 'h265', 'av1']);
const HINT_KEYS = /x-google-(min|start|max)-bitrate=\d+;?/g;

/**
 * Adds x-google-min/start/max-bitrate (kbps) to the a=fmtp line of every
 * video codec in an SDP. Without them WebRTC starts low and ramps slowly, so
 * the first seconds of motion look blurry. Adds an a=fmtp line when a codec
 * has none, replaces old hints, and leaves RTX/RED/FEC payloads alone.
 */
export function withBitrateHints(sdp: string, hints: BitrateHints): string {
  const eol = sdp.includes('\r\n') ? '\r\n' : '\n';
  const kbps = (bps: number) => Math.round(bps / 1000);
  const extra = [
    `x-google-min-bitrate=${kbps(hints.minBitrate)}`,
    `x-google-start-bitrate=${kbps(hints.startBitrate)}`,
    `x-google-max-bitrate=${kbps(hints.maxBitrate)}`
  ].join(';');

  const lines = sdp.split(/\r?\n/);

  // Which payload types in video sections are real codecs (not rtx, red, fec).
  const codecPts = new Set<string>();
  let inVideo = false;
  for (const line of lines) {
    if (line.startsWith('m=')) inVideo = line.startsWith('m=video');
    const m = inVideo ? /^a=rtpmap:(\d+) ([^/\s]+)/.exec(line) : null;
    if (m && CODECS.has(m[2]!.toLowerCase())) codecPts.add(m[1]!);
  }

  // Rewrite existing fmtp lines.
  const out: string[] = [];
  const seenFmtp = new Set<string>();
  inVideo = false;
  for (const line of lines) {
    if (line.startsWith('m=')) inVideo = line.startsWith('m=video');
    const fmtp = inVideo ? /^a=fmtp:(\d+) (.*)$/.exec(line) : null;
    if (fmtp && codecPts.has(fmtp[1]!)) {
      seenFmtp.add(fmtp[1]!);
      const rest = fmtp[2]!.replace(HINT_KEYS, '').replace(/;+$/, '');
      out.push(`a=fmtp:${fmtp[1]} ${rest ? `${rest};` : ''}${extra}`);
    } else {
      out.push(line);
    }
  }

  // Codecs with no fmtp line get one right after their rtpmap.
  const result: string[] = [];
  inVideo = false;
  for (const line of out) {
    result.push(line);
    if (line.startsWith('m=')) inVideo = line.startsWith('m=video');
    const m = inVideo ? /^a=rtpmap:(\d+) /.exec(line) : null;
    if (m && codecPts.has(m[1]!) && !seenFmtp.has(m[1]!)) result.push(`a=fmtp:${m[1]} ${extra}`);
  }
  return result.join(eol);
}

const FAMILY_BY_NAME: Record<string, string> = {
  vp8: 'vp8',
  vp9: 'vp9',
  h264: 'h264',
  h265: 'h265',
  hevc: 'h265',
  av1: 'av1'
};

/**
 * The video codec families in an SDP offer (`vp8`, `h264`, ...), once each, in the order of the
 * m=video payload list. RTX, RED and FEC payloads and audio are ignored.
 */
export function offeredCodecs(sdp: string): string[] {
  const lines = sdp.split(/\r?\n/);
  let order: string[] = [];
  const names = new Map<string, string>();
  let inVideo = false;
  for (const line of lines) {
    if (line.startsWith('m=')) {
      inVideo = line.startsWith('m=video');
      if (inVideo && order.length === 0) order = line.split(' ').slice(3);
      continue;
    }
    const m = inVideo ? /^a=rtpmap:(\d+) ([^/\s]+)/.exec(line) : null;
    if (m) names.set(m[1]!, m[2]!.toLowerCase());
  }
  const out: string[] = [];
  for (const pt of order) {
    const family = FAMILY_BY_NAME[names.get(pt) ?? ''];
    if (family && !out.includes(family)) out.push(family);
  }
  return out;
}
