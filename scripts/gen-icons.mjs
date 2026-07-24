#!/usr/bin/env node
/**
 * Generates simple PNG app icons (no dependencies, raw PNG encoder).
 * Output: public/icons/icon-180.png, icon-192.png, icon-512.png, icon-512-maskable.png
 * Design: deep-purple rounded square, yellow ball + cyan paddle, big "G".
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function makePixel(maskable) {
  // maskable icons need safe padding -> shrink the artwork
  const pad = maskable ? 0.12 : 0.0;
  const s = 1 - pad * 2; // artwork scale
  const tx = (v) => (v - pad) / s; // transform icon coords -> artwork coords

  return (x, y) => {
    const u = tx(x);
    const v = tx(y);
    // background: vertical gradient purple
    let r = lerp(0x2a, 0x1a, v);
    let g = lerp(0x1a, 0x10, v);
    let b = lerp(0x5e, 0x40, v);
    let a = 255;

    // rounded corner clipping (only for non-maskable)
    if (!maskable) {
      const rad = 0.18;
      const cx = Math.max(rad, Math.min(1 - rad, x));
      const cy = Math.max(rad, Math.min(1 - rad, y));
      if (Math.hypot(x - cx, y - cy) > rad) a = 0;
    }

    const inside = (u >= 0 && u <= 1 && v >= 0 && v <= 1) || maskable;
    if (inside) {
      const uu = Math.max(0, Math.min(1, u));
      const vv = Math.max(0, Math.min(1, v));
      // ball
      if (Math.hypot(uu - 0.5, vv - 0.34) < 0.13) {
        [r, g, b] = [0xff, 0xd2, 0x3f];
      }
      // paddle
      if (Math.abs(uu - 0.5) < 0.26 && vv > 0.62 && vv < 0.7) {
        [r, g, b] = [0x3f, 0xd2, 0xff];
      }
      // trail
      if (Math.abs(uu - 0.5) < 0.02 && vv > 0.42 && vv < 0.6) {
        [r, g, b] = [0xff, 0xff, 0xff];
      }
    }
    return [r, g, b, a];
  };
}

mkdirSync('public/icons', { recursive: true });
for (const [size, maskable] of [
  [180, false],
  [192, false],
  [512, false],
]) {
  writeFileSync(`public/icons/icon-${size}.png`, encodePNG(size, makePixel(false)));
}
writeFileSync('public/icons/icon-512-maskable.png', encodePNG(512, makePixel(true)));
console.log('Icons generated into public/icons/');
