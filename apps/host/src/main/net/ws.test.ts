import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { connect, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, before, test } from 'node:test';
import { LanServer, safeJoin } from './http-server.js';
import { FrameParser, OP, acceptKey, applyMask, encodeFrame, type WebSocketConnection } from './ws.js';

/** Builds a masked client frame, like a browser would send. */
function clientFrame(opcode: number, payload: Buffer, fin = true): Buffer {
  const key = randomBytes(4);
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0, 0x80 | len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = (fin ? 0x80 : 0) | opcode;
  return Buffer.concat([header, key, applyMask(payload, key)]);
}

test('accept key matches the RFC 6455 example', () => {
  assert.equal(acceptKey('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
});

test('parser handles frames split across chunks', () => {
  const parser = new FrameParser(1 << 20, true);
  const big = Buffer.from('x'.repeat(70_000));
  const bytes = Buffer.concat([clientFrame(OP.TEXT, Buffer.from('hi')), clientFrame(OP.TEXT, big)]);
  const frames = [];
  for (let i = 0; i < bytes.length; i += 1000) frames.push(...parser.push(bytes.subarray(i, i + 1000)));
  assert.equal(frames.length, 2);
  assert.equal(frames[0]!.payload.toString(), 'hi');
  assert.equal(frames[1]!.payload.length, 70_000);
});

test('parser rejects unmasked client frames and oversized frames', () => {
  assert.throws(() => new FrameParser(100, true).push(encodeFrame(OP.TEXT, Buffer.from('a'))));
  assert.throws(() => new FrameParser(10, true).push(clientFrame(OP.TEXT, Buffer.alloc(50))));
});

test('safeJoin never escapes the folder', () => {
  const dir = resolve('/srv/viewer');
  assert.ok(safeJoin(dir, '/index.html')?.endsWith('index.html'));
  for (const p of [
    '/../secret.txt',
    '/%2e%2e/secret.txt',
    '/a/../../b',
    '/..%2f..%2fetc/passwd',
    '/C:/Windows/win.ini'
  ]) {
    const r = safeJoin(dir, p);
    assert.ok(r === null || r.startsWith(dir + sep), `${p} -> ${r}`);
  }
  assert.equal(safeJoin(dir, '/%E0%A4%A'), null); // broken encoding
  assert.equal(safeJoin(dir, '/a%00b'), null); // null byte
});

// ---------- End to end over a real socket ----------

const PORT = 40000 + Math.floor(Math.random() * 20000);
let server: LanServer;
let lastConn: WebSocketConnection | null = null;

before(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pilotpane-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html><title>ok</title>');
  await writeFile(join(dir, 'secret.test.js'), 'nope');
  server = new LanServer({
    port: PORT,
    roots: [{ prefix: '/', dir }],
    onSocket: (conn) => {
      lastConn = conn;
      conn.on('message', (text: string) => conn.send(`echo:${text}`));
    },
    onListenError: (_a, err) => {
      throw err;
    }
  });
  server.sync(['127.0.0.1']);
  await new Promise((r) => setTimeout(r, 100));
});

after(() => server.closeAll());

function rawRequest(lines: string[]): Promise<{ sock: Socket; head: string; rest: Buffer }> {
  return new Promise((resolve, reject) => {
    const sock = connect(PORT, '127.0.0.1', () => sock.write(lines.join('\r\n') + '\r\n\r\n'));
    let buf = Buffer.alloc(0);
    const onData = (d: Buffer) => {
      buf = Buffer.concat([buf, d]);
      const end = buf.indexOf('\r\n\r\n');
      if (end >= 0) {
        sock.off('data', onData);
        resolve({ sock, head: buf.subarray(0, end).toString(), rest: buf.subarray(end + 4) });
      }
    };
    sock.on('data', onData);
    sock.on('error', reject);
  });
}

const host = () => `127.0.0.1:${PORT}`;
const upgradeLines = (origin: string, hostHeader = host()) => [
  'GET /ws HTTP/1.1',
  `Host: ${hostHeader}`,
  'Upgrade: websocket',
  'Connection: Upgrade',
  'Sec-WebSocket-Version: 13',
  `Sec-WebSocket-Key: ${randomBytes(16).toString('base64')}`,
  `Origin: ${origin}`
];

test('static file is served with security headers', async () => {
  const { sock, head } = await rawRequest(['GET / HTTP/1.1', `Host: ${host()}`, 'Connection: close']);
  sock.destroy();
  assert.match(head, /^HTTP\/1.1 200/);
  assert.match(head, /Content-Security-Policy: default-src 'self'/);
  assert.match(head, /X-Content-Type-Options: nosniff/);
});

test('test files, traversal and wrong Host are refused', async () => {
  for (const [path, hostHeader, status] of [
    ['/secret.test.js', host(), '404'],
    ['/../package.json', host(), '404'],
    ['/', `evil.example:${PORT}`, '421']
  ] as const) {
    const { sock, head } = await rawRequest([`GET ${path} HTTP/1.1`, `Host: ${hostHeader}`, 'Connection: close']);
    sock.destroy();
    assert.match(head, new RegExp(`^HTTP/1.1 ${status}`), `${path} ${hostHeader}`);
  }
});

test('WebSocket from another origin is refused', async () => {
  const { sock, head } = await rawRequest(upgradeLines('http://evil.example'));
  sock.destroy();
  assert.match(head, /^HTTP\/1.1 403/);
});

test('WebSocket echo round trip, including a fragmented message', async () => {
  const { sock, head, rest } = await rawRequest(upgradeLines(`http://${host()}`));
  assert.match(head, /^HTTP\/1.1 101/);
  assert.ok(lastConn);

  const parser = new FrameParser(1 << 20, false);
  const received: string[] = [];
  const wait = new Promise<void>((resolve) => {
    const onBytes = (d: Buffer) => {
      for (const f of parser.push(d)) if (f.opcode === OP.TEXT) received.push(f.payload.toString());
      if (received.length === 2) resolve();
    };
    if (rest.length) onBytes(rest);
    sock.on('data', onBytes);
  });

  sock.write(clientFrame(OP.TEXT, Buffer.from('hello')));
  sock.write(clientFrame(OP.TEXT, Buffer.from('frag'), false));
  sock.write(clientFrame(OP.CONT, Buffer.from('mented'), true));
  await wait;
  assert.deepEqual(received, ['echo:hello', 'echo:fragmented']);

  const closed = new Promise<void>((resolve) => lastConn!.once('close', () => resolve()));
  sock.write(clientFrame(OP.CLOSE, Buffer.from([0x03, 0xe8])));
  await closed;
  sock.destroy();
});
