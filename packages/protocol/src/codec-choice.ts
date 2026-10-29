/** What the viewer knows about a codec: true = decodes 1080p at 30 fps smoothly, false = it does not, null = unknown. */
export type CodecCapabilities = Partial<Record<string, boolean | null>>;

/** The codec family of an RTP mime type: `video/H264` gives `h264`, `video/rtx` gives `rtx`. */
export function codecFamily(mimeType: string): string {
  const name = (mimeType.split('/')[1] ?? '').toLowerCase();
  return name === 'hevc' ? 'h265' : name;
}

/**
 * The order in which the viewer prefers the codecs the host offered (ADR-020).
 * VP8 goes first only when it is offered and known to decode smoothly (it is sharper in motion).
 * Otherwise H.264 goes first when it is offered and not known to fail, because an unknown answer
 * must not leave an old viewer on a software decoder. The rest follow in the offer's own order.
 */
export function chooseCodec(offered: readonly string[], capabilities: CodecCapabilities): string[] {
  const first =
    offered.includes('vp8') && capabilities['vp8'] === true
      ? 'vp8'
      : offered.includes('h264') && capabilities['h264'] !== false
        ? 'h264'
        : undefined;
  return first ? [first, ...offered.filter((c) => c !== first)] : [...offered];
}
