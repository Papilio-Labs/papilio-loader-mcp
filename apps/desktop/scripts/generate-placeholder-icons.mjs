// generate-placeholder-icons.mjs — produces build/icon.{ico,icns,png} and
// build/tray.png: a plain "brand dot" (papilioworks.com's --bg/--accent
// colors) so electron-builder and the tray have *something* other than the
// default Electron icon. Replace with a real Papilio/Gadget Factory logo
// asset when one exists — re-run `node scripts/generate-placeholder-icons.mjs`
// any time the palette changes. No image-library dependency: encodes raw
// PNG chunks (via node:zlib deflate) and wraps them in ICO/ICNS containers,
// both of which accept plain embedded PNG data on modern Windows/macOS.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../build");
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Palette from papilioworks.com/css/style.css (--bg / --accent).
const BG = [0x0d, 0x0d, 0x0f];
const ACCENT = [0x00, 0xe5, 0xa0];

function renderCircle(size) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44;
  const ringR = size * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      if (d <= r) {
        px.set(ACCENT, i);
        px[i + 3] = 255;
      } else if (d <= ringR) {
        px.set(BG, i);
        px[i + 3] = 255;
      } else {
        px[i + 3] = 0;
      }
    }
  }
  return px;
}

function encodePNG(size) {
  const raw = renderCircle(size);
  const stride = size * 4;
  const withFilters = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    withFilters[y * (stride + 1)] = 0; // filter: none
    raw.copy(withFilters, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(withFilters);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolor + alpha

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function encodeICO(sizes) {
  const images = sizes.map((s) => encodePNG(s));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const entries = [];
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const data = images[i];
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // 0 means 256px
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images]);
}

function encodeICNS(sizes) {
  const TAGS = { 16: "icp4", 32: "icp5", 128: "ic07", 256: "ic08", 512: "ic09" };
  const entries = sizes
    .filter((s) => TAGS[s])
    .map((s) => {
      const png = encodePNG(s);
      const tag = Buffer.from(TAGS[s], "ascii");
      const len = Buffer.alloc(4);
      len.writeUInt32BE(8 + png.length, 0);
      return Buffer.concat([tag, len, png]);
    });
  const body = Buffer.concat(entries);
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([header, body]);
}

writeFileSync(path.join(outDir, "icon.png"), encodePNG(256));
writeFileSync(path.join(outDir, "icon.ico"), encodeICO([16, 32, 48, 256]));
writeFileSync(path.join(outDir, "icon.icns"), encodeICNS([16, 32, 128, 256, 512]));
writeFileSync(path.join(outDir, "tray.png"), encodePNG(32));

console.log("Generated placeholder icons in", outDir);
