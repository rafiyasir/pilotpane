/**
 * A small WebSocket server-side connection (RFC 6455), written on purpose
 * instead of using a package. Supports what PilotPane needs: text messages,
 * fragmentation, ping/pong and close. No extensions, no binary messages.
 */
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

/** Fixed by RFC 6455 section 1.3. */
export const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export const OP = { CONT: 0x0, TEXT: 0x1, BINARY: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xa } as const;

export const CLOSE = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  PROTOCOL_ERROR: 1002,
  UNSUPPORTED: 1003,
  BAD_DATA: 1007,
  POLICY: 1008,
  TOO_BIG: 1009
} as const;

export function acceptKey(clientKey: string): string {
  return createHash('sha1')
    .update(clientKey + WS_GUID)
    .digest('base64');
}

export interface Frame {
  fin: boolean;
  opcode: number;
  payload: Buffer;
}

export class WsProtocolError extends Error {
  constructor(
    message: string,
    readonly code: number
  ) {
    super(message);
  }
}

/** Builds one unmasked frame (server frames are never masked). */
export function encodeFrame(opcode: number, payload: Buffer, fin = true): Buffer {
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = (fin ? 0x80 : 0) | opcode;
  return Buffer.concat([header, payload]);
}

/** Masks (or unmasks, it is the same XOR) a payload with a 4-byte key. */
export function applyMask(payload: Buffer, key: Buffer): Buffer {
  const out = Buffer.allocUnsafe(payload.length);
  for (let i = 0; i < payload.length; i++) out[i] = payload[i]! ^ key[i & 3]!;
  return out;
}

/**
 * Reads frames out of a byte stream. TCP can split or merge frames, so bytes
 * are buffered until a whole frame is available.
 */
export class FrameParser {
  private buf: Buffer = Buffer.alloc(0);

  constructor(
    private readonly maxPayload: number,
    private readonly requireMask: boolean
  ) {}

  push(chunk: Buffer): Frame[] {
    this.buf = this.buf.length === 0 ? chunk : Buffer.concat([this.buf, chunk]);
    const frames: Frame[] = [];

    for (;;) {
      if (this.buf.length < 2) break;
      const b0 = this.buf[0]!;
      const b1 = this.buf[1]!;
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;

      if ((b0 & 0x70) !== 0) throw new WsProtocolError('reserved bits set', CLOSE.PROTOCOL_ERROR);
      if (this.requireMask && !masked) throw new WsProtocolError('client frame not masked', CLOSE.PROTOCOL_ERROR);
      if (opcode >= 0x8) {
        if (!fin || len > 125) throw new WsProtocolError('bad control frame', CLOSE.PROTOCOL_ERROR);
      } else if (opcode > 0x2) {
        throw new WsProtocolError(`unknown opcode ${opcode}`, CLOSE.PROTOCOL_ERROR);
      }

      if (len === 126) {
        if (this.buf.length < 4) break;
        len = this.buf.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) break;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(this.maxPayload)) throw new WsProtocolError('frame too big', CLOSE.TOO_BIG);
        len = Number(big);
        offset = 10;
      }
      if (len > this.maxPayload) throw new WsProtocolError('frame too big', CLOSE.TOO_BIG);

      const maskLen = masked ? 4 : 0;
      if (this.buf.length < offset + maskLen + len) break;

      const key = masked ? this.buf.subarray(offset, offset + 4) : null;
      const start = offset + maskLen;
      const raw = this.buf.subarray(start, start + len);
      const payload = key ? applyMask(raw, key) : Buffer.from(raw);
      frames.push({ fin, opcode, payload });
      this.buf = this.buf.subarray(start + len);
    }
    return frames;
  }
}

export interface WsOptions {
  maxMessageBytes: number;
  pingIntervalMs: number;
}

/**
 * One open WebSocket. Events:
 *  - 'message' (text: string)
 *  - 'close' (code: number, reason: string), emitted exactly once
 */
export class WebSocketConnection extends EventEmitter {
  private readonly parser: FrameParser;
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private fragments: Buffer[] = [];
  private fragmentBytes = 0;
  private alive = true;
  private closed = false;
  private readonly pingTimer: NodeJS.Timeout;

  constructor(
    private readonly socket: Duplex,
    private readonly opts: WsOptions
  ) {
    super();
    this.parser = new FrameParser(opts.maxMessageBytes, true);
    socket.on('data', (chunk: Buffer) => this.onData(chunk));
    // The HTTP server keeps sockets half-open, so a peer that just goes away
    // only sends 'end'. Close our side too, or the viewer would look connected.
    socket.on('end', () => {
      socket.end();
      this.finish(CLOSE.GOING_AWAY, 'peer ended');
    });
    socket.on('close', () => this.finish(CLOSE.GOING_AWAY, 'socket closed'));
    socket.on('error', () => this.finish(CLOSE.GOING_AWAY, 'socket error'));

    this.pingTimer = setInterval(() => {
      if (!this.alive) {
        this.socket.destroy();
        this.finish(CLOSE.GOING_AWAY, 'ping timeout');
        return;
      }
      this.alive = false;
      this.write(encodeFrame(OP.PING, Buffer.alloc(0)));
    }, opts.pingIntervalMs);
    this.pingTimer.unref();
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  send(text: string): void {
    if (this.closed) return;
    this.write(encodeFrame(OP.TEXT, Buffer.from(text, 'utf8')));
  }

  close(code: number = CLOSE.NORMAL, reason = ''): void {
    if (this.closed) return;
    const body = Buffer.alloc(2 + Buffer.byteLength(reason));
    body.writeUInt16BE(code, 0);
    body.write(reason, 2);
    this.write(encodeFrame(OP.CLOSE, body));
    this.socket.end();
    this.finish(code, reason);
  }

  /** Feeds bytes that arrived together with the upgrade request. */
  feed(head: Buffer): void {
    if (head.length > 0) this.onData(head);
  }

  private onData(chunk: Buffer): void {
    if (this.closed) return;
    let frames: Frame[];
    try {
      frames = this.parser.push(chunk);
    } catch (err) {
      const code = err instanceof WsProtocolError ? err.code : CLOSE.PROTOCOL_ERROR;
      this.close(code, 'protocol error');
      return;
    }
    for (const f of frames) {
      this.handleFrame(f);
      if (this.closed) return;
    }
  }

  private handleFrame(f: Frame): void {
    this.alive = true;
    switch (f.opcode) {
      case OP.PING:
        this.write(encodeFrame(OP.PONG, f.payload));
        return;
      case OP.PONG:
        return;
      case OP.CLOSE: {
        const code = f.payload.length >= 2 ? f.payload.readUInt16BE(0) : CLOSE.NORMAL;
        this.close(code, 'closed by peer');
        return;
      }
      case OP.BINARY:
        this.close(CLOSE.UNSUPPORTED, 'binary not supported');
        return;
      case OP.TEXT:
      case OP.CONT: {
        if (f.opcode === OP.TEXT && this.fragments.length > 0) {
          this.close(CLOSE.PROTOCOL_ERROR, 'unexpected new message');
          return;
        }
        if (f.opcode === OP.CONT && this.fragments.length === 0) {
          this.close(CLOSE.PROTOCOL_ERROR, 'unexpected continuation');
          return;
        }
        this.fragments.push(f.payload);
        this.fragmentBytes += f.payload.length;
        if (this.fragmentBytes > this.opts.maxMessageBytes) {
          this.close(CLOSE.TOO_BIG, 'message too big');
          return;
        }
        if (!f.fin) return;
        const whole = Buffer.concat(this.fragments);
        this.fragments = [];
        this.fragmentBytes = 0;
        let text: string;
        try {
          text = this.decoder.decode(whole);
        } catch {
          this.close(CLOSE.BAD_DATA, 'invalid utf-8');
          return;
        }
        this.emit('message', text);
        return;
      }
    }
  }

  private write(buf: Buffer): void {
    if (!this.socket.destroyed && this.socket.writable) this.socket.write(buf);
  }

  private finish(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.pingTimer);
    this.emit('close', code, reason);
  }
}

export interface UpgradeCheck {
  /** "host:port" values a browser may legitimately use to reach us. */
  allowedHosts: ReadonlySet<string>;
}

function reject(socket: Duplex, status: string): null {
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  return null;
}

/**
 * Validates an HTTP upgrade request and completes the handshake.
 * Returns null (after answering with an error) when the request is refused.
 */
export function acceptUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  check: UpgradeCheck,
  opts: WsOptions
): WebSocketConnection | null {
  const h = req.headers;
  const host = h.host ?? '';
  const key = h['sec-websocket-key'];

  if (req.method !== 'GET') return reject(socket, '405 Method Not Allowed');
  if ((h.upgrade ?? '').toLowerCase() !== 'websocket') return reject(socket, '400 Bad Request');
  if (!(h.connection ?? '').toLowerCase().includes('upgrade')) return reject(socket, '400 Bad Request');
  if (h['sec-websocket-version'] !== '13') return reject(socket, '426 Upgrade Required');
  if (typeof key !== 'string' || Buffer.from(key, 'base64').length !== 16) return reject(socket, '400 Bad Request');

  // Only our own LAN addresses, and only pages we served ourselves.
  // This blocks DNS rebinding and other websites opening a socket to us.
  if (!check.allowedHosts.has(host)) return reject(socket, '421 Misdirected Request');
  if (h.origin !== `http://${host}`) return reject(socket, '403 Forbidden');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`
  );
  const conn = new WebSocketConnection(socket, opts);
  conn.feed(head);
  return conn;
}
