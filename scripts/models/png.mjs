/** 產生 cols×rows RGB PNG（色盤圖集，預設 4×5），免額外相依 */
import zlib from 'node:zlib';

const TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** colors：最多 cols×rows 個 '#RRGGBB'，列優先；不足補黑 */
export function palettePng(colors, cols = 4, rows = 5) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cols, 0);
  ihdr.writeUInt32BE(rows, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc(rows * (cols * 3 + 1));
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const hex = (colors[y * cols + x] || '#000000').slice(1);
      const o = y * (cols * 3 + 1) + 1 + x * 3;
      raw[o] = parseInt(hex.slice(0, 2), 16);
      raw[o + 1] = parseInt(hex.slice(2, 4), 16);
      raw[o + 2] = parseInt(hex.slice(4, 6), 16);
    }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return new Uint8Array(Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
