// Wraps apps/host/assets/icon-256.png in an ICO container (ICO can hold PNG data), so no image package is needed.
// Run it when the icon changes; the result is committed as apps/host/assets/icon.ico.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pngPath = join(root, 'apps/host/assets/icon-256.png');
const icoPath = join(root, 'apps/host/assets/icon.ico');

const png = await readFile(pngPath);
const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (png.length < 24 || !png.subarray(0, 8).equals(signature)) throw new Error('icon-256.png is not a PNG file');
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width !== 256 || height !== 256) throw new Error(`icon-256.png must be 256x256, got ${width}x${height}`);

const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count
header.writeUInt8(0, 6); // width 0 means 256
header.writeUInt8(0, 7); // height 0 means 256
header.writeUInt8(0, 8); // palette size
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14); // image data size
header.writeUInt32LE(header.length, 18); // image data offset

await writeFile(icoPath, Buffer.concat([header, png]));
console.log(`wrote apps/host/assets/icon.ico (${header.length + png.length} bytes)`);
