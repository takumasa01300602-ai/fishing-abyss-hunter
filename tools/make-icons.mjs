// 深海フィッシング：アビス・ハンター（fishing-abyss-hunter）のアイコン（PNG）を作るスクリプト
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const circleSd = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
const fill = (sd) => (x, y) => sd(x, y) <= 0;
const stroke = (sd, w) => (x, y) => Math.abs(sd(x, y)) <= w / 2;
const rect = (x, y, w, h) => (px, py) => px >= x && px <= x + w && py >= y && py <= y + h;
const rrect = (x, y, w, h, r) => (px, py) => {
  const cx = Math.min(Math.max(px, x + r), x + w - r), cy = Math.min(Math.max(py, y + r), y + h - r);
  return px >= x && px <= x + w && py >= y && py <= y + h && Math.hypot(px - cx, py - cy) <= r;
};

const shapes = [

      [() => true, '#041424'],
      [fill(circleSd(256, 256, 204)), '#072a47'],
      [stroke(circleSd(256, 256, 196), 8), '#2dd4bf'],
      [rrect(250, 96, 12, 190, 6), '#2dd4bf'],
      [stroke(circleSd(292, 290, 42), 14), '#fbbf24'],
      [fill(circleSd(184, 336, 28)), '#2dd4bf'],
      [fill(circleSd(164, 232, 16)), '#38bdf8'],
      [fill(circleSd(346, 196, 12)), '#f472b6']
    
].map(([test, col]) => [test, hex(col)]);

function render(size) {
  const ss = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const x = ((i + (sx + 0.5) / ss) / size) * 512, y = ((j + (sy + 0.5) / ss) / size) * 512;
      let c = null;
      for (const [test, col] of shapes) if (test(x, y)) c = col;
      if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
    }
    const k = (j * size + i) * 4, n = ss * ss;
    const m = a / 255 || 1; px[k] = Math.round(r / m); px[k + 1] = Math.round(g / m); px[k + 2] = Math.round(b / m); px[k + 3] = Math.round(a / n);
  }
  return png(size, size, px);
}

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  writeFileSync(new URL(name, out), render(size));
  console.log('作成:', name, size + 'px');
}
