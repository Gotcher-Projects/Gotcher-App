// Pure-Node PNG generator — no dependencies (just zlib).
// Produces a high-resolution (900×1200, 3:4 like the book canvas) truecolor PNG so the self-test page can
// prove NATIVE-RESOLUTION raster embedding OFFLINE (no network image fetch needed in the container).
// The grid + gradient make resolution/detail obvious when you zoom the generated PDF.

import zlib from 'zlib';
import fs from 'fs';
import path from 'path';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(width, height, fill) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter type 0 (none) per scanline
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y, width, height);
      raw[p++] = r & 0xff;
      raw[p++] = g & 0xff;
      raw[p++] = b & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = truecolor RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // no interlace
  const idat = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const WIDTH = 900;
const HEIGHT = 1200;

const png = makePng(WIDTH, HEIGHT, (x, y, w, h) => {
  const r = Math.floor((255 * x) / w);
  const g = Math.floor((255 * y) / h);
  const b = Math.floor(255 * (1 - x / w));
  // Thin grid lines every 100px darken the gradient so fine detail (hence native resolution) is visible.
  const grid = x % 100 < 2 || y % 100 < 2 ? 60 : 0;
  return [Math.max(0, r - grid), Math.max(0, g - grid), Math.max(0, b - grid)];
});

const out = process.argv[2] || path.join('public', 'sample.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes, ${WIDTH}x${HEIGHT})`);
