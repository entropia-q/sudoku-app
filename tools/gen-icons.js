// 依存ライブラリなしで数独アイコン(PNG)を生成する。
// Node 標準の zlib のみ使用。塗り＋グリッド線のシンプルな図柄。
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = process.argv[2] || ".";

/* ---------- 最小 PNG エンコーダ ---------- */
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- 図柄を描く ---------- */
const BG = [37, 99, 235];      // #2563eb (テーマカラー)
const ACCENT = [30, 64, 175];  // #1e40af (塗りセル)
const THIN = [147, 197, 253];  // #93c5fd (細線)
const WHITE = [255, 255, 255]; // 太線

function makeIcon(S) {
  const buf = Buffer.alloc(S * S * 4);
  const set = (x, y, col) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = 255;
  };
  const rect = (x0, y0, x1, y1, col) => {
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++)
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) set(x, y, col);
  };

  rect(0, 0, S, S, BG); // 背景は全面(maskable でも安全)

  // グリッドはセーフゾーン内に収める
  const pad = S * 0.21;
  const gs = S - pad * 2;
  const cell = gs / 9;

  // アクセントの塗りセル(数独らしさ)
  const accents = [[0, 1], [4, 4], [7, 2], [2, 6], [6, 7], [3, 0], [8, 8]];
  for (const [c, r] of accents) {
    rect(pad + c * cell, pad + r * cell, pad + (c + 1) * cell, pad + (r + 1) * cell, ACCENT);
  }

  const thin = Math.max(1, Math.round(S * 0.006));
  const thick = Math.max(2, Math.round(S * 0.02));
  for (let k = 0; k <= 9; k++) {
    const w = k % 3 === 0 ? thick : thin;
    const col = k % 3 === 0 ? WHITE : THIN;
    const v = pad + k * cell;
    rect(v - w / 2, pad - thick / 2, v + w / 2, pad + gs + thick / 2, col); // 縦線
    rect(pad - thick / 2, v - w / 2, pad + gs + thick / 2, v + w / 2, col); // 横線
  }
  return encodePNG(S, S, buf);
}

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, makeIcon(size));
  console.log("wrote", p, fs.statSync(p).size, "bytes");
}
