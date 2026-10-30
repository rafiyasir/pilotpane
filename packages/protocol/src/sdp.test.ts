import assert from 'node:assert/strict';
import { test } from 'node:test';
import { offeredCodecs, withBitrateHints } from './sdp.js';

const hints = { minBitrate: 3_000_000, startBitrate: 6_000_000, maxBitrate: 12_000_000 };
const EXTRA = 'x-google-min-bitrate=3000;x-google-start-bitrate=6000;x-google-max-bitrate=12000';

const head = [
  'v=0',
  'o=- 1 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111',
  'a=rtpmap:111 opus/48000/2'
];
const join = (l: string[]) => l.join('\r\n') + '\r\n';

test('appends hints to an existing fmtp line', () => {
  const sdp = join([...head, 'm=video 9 UDP/TLS/RTP/SAVPF 96', 'a=rtpmap:96 VP8/90000', 'a=fmtp:96 level=1']);
  const out = withBitrateHints(sdp, hints);
  assert.ok(out.includes(`a=fmtp:96 level=1;${EXTRA}`));
});

test('adds an fmtp line when the codec has none', () => {
  const sdp = join([...head, 'm=video 9 UDP/TLS/RTP/SAVPF 96', 'a=rtpmap:96 VP8/90000', 'a=rtcp-fb:96 nack']);
  const out = withBitrateHints(sdp, hints).split('\r\n');
  const i = out.indexOf('a=rtpmap:96 VP8/90000');
  assert.equal(out[i + 1], `a=fmtp:96 ${EXTRA}`);
});

test('handles several codecs, skips rtx and audio', () => {
  const sdp = join([
    ...head,
    'm=video 9 UDP/TLS/RTP/SAVPF 96 97 102 103',
    'a=rtpmap:96 VP8/90000',
    'a=rtpmap:97 rtx/90000',
    'a=fmtp:97 apt=96',
    'a=rtpmap:102 H264/90000',
    'a=fmtp:102 packetization-mode=1',
    'a=rtpmap:103 rtx/90000',
    'a=fmtp:103 apt=102'
  ]);
  const out = withBitrateHints(sdp, hints);
  assert.ok(out.includes(`a=fmtp:96 ${EXTRA}`));
  assert.ok(out.includes(`a=fmtp:102 packetization-mode=1;${EXTRA}`));
  assert.ok(out.includes('a=fmtp:97 apt=96\r\n'));
  assert.ok(out.includes('a=fmtp:103 apt=102\r\n'));
  assert.ok(!out.includes('a=fmtp:111'));
});

test('is idempotent', () => {
  const sdp = join([
    ...head,
    'm=video 9 UDP/TLS/RTP/SAVPF 96 102',
    'a=rtpmap:96 VP8/90000',
    'a=rtpmap:102 H264/90000',
    'a=fmtp:102 level=1'
  ]);
  const once = withBitrateHints(sdp, hints);
  assert.equal(withBitrateHints(once, hints), once);
});

const video = (pts: string, rest: string[]) => join([...head, `m=video 9 UDP/TLS/RTP/SAVPF ${pts}`, ...rest]);

test('offeredCodecs lists families in payload order and ignores rtx, red and audio', () => {
  const sdp = video('96 97 102 103 104 105', [
    'a=rtpmap:96 VP8/90000',
    'a=rtpmap:97 rtx/90000',
    'a=rtpmap:102 H264/90000',
    'a=rtpmap:103 H264/90000',
    'a=rtpmap:104 red/90000',
    'a=rtpmap:105 ulpfec/90000'
  ]);
  assert.deepEqual(offeredCodecs(sdp), ['vp8', 'h264']);
});

test('offeredCodecs follows the m=video line, not the rtpmap order', () => {
  const sdp = video('102 96', ['a=rtpmap:96 VP8/90000', 'a=rtpmap:102 H264/90000']);
  assert.deepEqual(offeredCodecs(sdp), ['h264', 'vp8']);
});

test('offeredCodecs returns nothing without video', () => {
  assert.deepEqual(offeredCodecs(join(head)), []);
});
