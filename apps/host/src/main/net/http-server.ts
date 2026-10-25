/**
 * Serves the viewer page and the WebSocket on the LAN, using only node:http.
 *
 * One http.Server listens on each private address (never 0.0.0.0), so
 * PilotPane can't be reached through a public network adapter. The address
 * list is refreshed while running, so plugging in a cable "just works".
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, normalize, resolve, sep } from 'node:path';
import type { Duplex } from 'node:stream';
import { MAX_MESSAGE_BYTES, WS_PATH } from '@pilotpane/protocol';
import { createLogger } from '../log.js';
import { plainIPv4 } from './lan.js';
import { acceptUpgrade, type WebSocketConnection } from './ws.js';

const log = createLogger('http');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

export interface StaticRoot {
  /** URL prefix such as "/protocol/". "/" is the fallback root. */
  prefix: string;
  dir: string;
}

export interface ClientInfo {
  remoteAddress: string;
  userAgent: string;
}

export interface LanServerOptions {
  port: number;
  roots: StaticRoot[];
  onSocket(conn: WebSocketConnection, info: ClientInfo): void;
  onListenError(address: string, err: NodeJS.ErrnoException): void;
}

/** Resolves a URL path inside a directory, or null if it would escape it. */
export function safeJoin(dir: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const root = resolve(dir);
  const full = resolve(root, normalize(decoded).replace(/^[\\/]+/, ''));
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

export class LanServer {
  private readonly servers = new Map<string, Server>();
  private allowedHosts = new Set<string>();

  constructor(private readonly opts: LanServerOptions) {}

  get port(): number {
    return this.opts.port;
  }

  get listening(): string[] {
    return [...this.servers.keys()];
  }

  /** Starts listening on new addresses and stops on ones that disappeared. */
  sync(addresses: string[]): void {
    const wanted = new Set(addresses);
    for (const [address, server] of this.servers) {
      if (!wanted.has(address)) {
        server.close();
        this.servers.delete(address);
        log.info(`stopped listening on ${address}`);
      }
    }
    for (const address of wanted) {
      if (!this.servers.has(address)) this.listen(address);
    }
    this.allowedHosts = new Set([...wanted].map((a) => `${a}:${this.opts.port}`));
    this.allowedHosts.add(`localhost:${this.opts.port}`);
  }

  closeAll(): void {
    for (const server of this.servers.values()) {
      server.closeAllConnections();
      server.close();
    }
    this.servers.clear();
    this.allowedHosts.clear();
  }

  private listen(address: string): void {
    const server = createServer((req, res) => {
      this.handleRequest(req, res).catch((err: unknown) => {
        log.error('request failed', err);
        if (!res.headersSent) res.writeHead(500).end();
        else res.destroy();
      });
    });
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => this.handleUpgrade(req, socket, head));
    server.on('error', (err: NodeJS.ErrnoException) => {
      this.servers.delete(address);
      this.opts.onListenError(address, err);
    });
    server.headersTimeout = 10_000;
    server.requestTimeout = 30_000;
    server.listen(this.opts.port, address, () => log.info(`listening on http://${address}:${this.opts.port}`));
    this.servers.set(address, server);
  }

  private handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const path = (req.url ?? '').split('?')[0];
    if (path !== WS_PATH) {
      socket.destroy();
      return;
    }
    const conn = acceptUpgrade(
      req,
      socket,
      head,
      { allowedHosts: this.allowedHosts },
      { maxMessageBytes: MAX_MESSAGE_BYTES, pingIntervalMs: 10_000 }
    );
    if (!conn) {
      log.warn(
        `refused WebSocket from ${plainIPv4(req.socket.remoteAddress)} (host=${req.headers.host}, origin=${req.headers.origin})`
      );
      return;
    }
    this.opts.onSocket(conn, {
      remoteAddress: plainIPv4(req.socket.remoteAddress),
      userAgent: String(req.headers['user-agent'] ?? '')
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const host = req.headers.host ?? '';
    if (!this.allowedHosts.has(host)) {
      res.writeHead(421).end('Misdirected request');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    let path = (req.url ?? '/').split('?')[0] ?? '/';
    if (path === '/') path = '/index.html';

    const root =
      this.opts.roots.find((r) => r.prefix !== '/' && path.startsWith(r.prefix)) ??
      this.opts.roots.find((r) => r.prefix === '/');
    if (!root) {
      res.writeHead(404).end();
      return;
    }
    const rel = root.prefix === '/' ? path : path.slice(root.prefix.length - 1);
    const file = safeJoin(root.dir, rel);
    const ext = extname(file ?? '').toLowerCase();
    if (!file || !TYPES[ext] || /(^|[\\/])\./.test(rel) || file.includes('.test.')) {
      res.writeHead(404).end('Not found');
      return;
    }

    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }

    const headers: Record<string, string | number> = {
      'Content-Type': TYPES[ext]!,
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    };
    if (ext === '.html') {
      headers['Content-Security-Policy'] = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        `connect-src 'self' ws://${host}`,
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'"
      ].join('; ');
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  }
}
