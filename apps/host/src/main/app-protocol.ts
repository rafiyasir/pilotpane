/**
 * Serves the host's own windows from app://bundle/... instead of file://.
 * A registered "secure" scheme lets the windows use ES modules and media
 * capture, and keeps them away from the LAN server entirely.
 */
import { net, protocol } from 'electron';
import { extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { safeJoin } from './net/http-server.js';

export const APP_ORIGIN = 'app://bundle';

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ]);
}

const ALLOWED = new Set(['.html', '.js', '.css', '.png', '.svg', '.map']);

export function handleAppScheme(rendererDir: string, protocolDir: string): void {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'bundle') return new Response('Not found', { status: 404 });

    const isProtocol = url.pathname.startsWith('/protocol/');
    const base = isProtocol ? protocolDir : rendererDir;
    const rel = isProtocol ? url.pathname.slice('/protocol'.length) : url.pathname;
    const file = safeJoin(base, rel);
    if (!file || !ALLOWED.has(extname(file).toLowerCase()) || file.includes('.test.')) {
      return new Response('Not found', { status: 404 });
    }
    // The bundle changes between builds: never let Chromium reuse an old copy of a module.
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, headers });
  });
}
