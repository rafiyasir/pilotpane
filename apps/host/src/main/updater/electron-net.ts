/**
 * The only place the updater touches the internet: Electron's `net.fetch`,
 * with a timeout and a hard size cap. Used only after a user click.
 */
import { net } from 'electron';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { once } from 'node:events';

const TIMEOUT_MS = 20_000;

/** Starts the request. The timeout covers only waiting for the response to begin, so big downloads are not cut off. */
async function open(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await net.fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url: string, maxBytes: number): Promise<string> {
  const res = await open(url);
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('response is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function downloadFile(
  url: string,
  dest: string,
  maxBytes: number,
  onProgress: (receivedBytes: number) => void
): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await rm(dest, { force: true });
  const res = await open(url);
  const reader = res.body!.getReader();
  const out = createWriteStream(dest);
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > maxBytes) throw new Error('download is larger than the manifest says');
      if (!out.write(value)) await once(out, 'drain');
      onProgress(received);
    }
    out.end();
    await once(out, 'close');
  } catch (err) {
    out.destroy();
    await reader.cancel().catch(() => undefined);
    throw err;
  }
}
