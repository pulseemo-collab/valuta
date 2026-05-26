#!/usr/bin/env node
/**
 * Generates Valuta branded PNG assets using only Node.js built-ins.
 * No external dependencies required.
 *
 * Usage: node scripts/generate-assets.js
 * Output: assets/favicon.png, assets/icon.png, assets/adaptive-icon.png, assets/splash.png
 */

'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── Brand palette ─────────────────────────────────────────────────────────────

const BG      = [6,   11,  24,  255]; // #060B18 — dark navy
const CARD_BG = [13,  37,  26,  255]; // #0D251A — dark emerald-tinted surface
const EMERALD = [16, 185, 129, 255];  // #10B981 — primary accent

// ── PNG encoder (no external deps) ───────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf  = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(w, h, pixels) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw scanlines: [filter_byte, r, g, b, a, ...] per row
  const stride = 1 + w * 4;
  const raw = Buffer.allocUnsafe(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = y * stride + 1 + x * 4;
      raw[dst]     = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing primitives ────────────────────────────────────────────────────────

function fillRect(pixels, w, h, x, y, fw, fh, color) {
  const [r, g, b, a] = color;
  const x1 = Math.min(x + fw, w);
  const y1 = Math.min(y + fh, h);
  for (let py = Math.max(0, y); py < y1; py++) {
    for (let px = Math.max(0, x); px < x1; px++) {
      const i = (py * w + px) * 4;
      pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
    }
  }
}

function fill(pixels, w, h, color) {
  fillRect(pixels, w, h, 0, 0, w, h, color);
}

// Rounded rectangle using SDF (signed distance field) — anti-aliased edge
function roundRect(pixels, w, h, rx, ry, rw, rh, radius, color) {
  const [r, g, b, a] = color;
  const effR  = Math.min(radius, Math.floor(rw / 2), Math.floor(rh / 2));
  const effRSq = effR * effR;
  const ix0 = rx + effR, ix1 = rx + rw - effR;
  const iy0 = ry + effR, iy1 = ry + rh - effR;

  for (let py = ry; py < ry + rh; py++) {
    if (py < 0 || py >= h) continue;
    for (let px = rx; px < rx + rw; px++) {
      if (px < 0 || px >= w) continue;
      const nearX = Math.max(ix0, Math.min(ix1, px));
      const nearY = Math.max(iy0, Math.min(iy1, py));
      const dSq = (px - nearX) ** 2 + (py - nearY) ** 2;
      if (dSq <= effRSq) {
        const i = (py * w + px) * 4;
        pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
      }
    }
  }
}

// Draw line segments with rounded caps, bounded iteration for performance
function drawLines(pixels, w, h, segments, color, halfT) {
  const [r, g, b, a] = color;
  const htSq = halfT * halfT;

  // Bounding box of all segments + padding
  let x0b = Infinity, y0b = Infinity, x1b = -Infinity, y1b = -Infinity;
  for (const [ax, ay, bx, by] of segments) {
    x0b = Math.min(x0b, ax, bx); y0b = Math.min(y0b, ay, by);
    x1b = Math.max(x1b, ax, bx); y1b = Math.max(y1b, ay, by);
  }
  const startX = Math.max(0, Math.floor(x0b - halfT - 1));
  const startY = Math.max(0, Math.floor(y0b - halfT - 1));
  const endX   = Math.min(w - 1, Math.ceil(x1b + halfT + 1));
  const endY   = Math.min(h - 1, Math.ceil(y1b + halfT + 1));

  for (let py = startY; py <= endY; py++) {
    for (let px = startX; px <= endX; px++) {
      let minDSq = Infinity;
      for (const [ax, ay, bx, by] of segments) {
        const dx = bx - ax, dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1,
          ((px - ax) * dx + (py - ay) * dy) / lenSq
        ));
        const nx = ax + t * dx, ny = ay + t * dy;
        const dSq = (px - nx) ** 2 + (py - ny) ** 2;
        if (dSq < minDSq) minDSq = dSq;
      }
      if (minDSq <= htSq) {
        const i = (py * w + px) * 4;
        pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
      }
    }
  }
}

// ── V-letter helper ───────────────────────────────────────────────────────────

// Draws the letter V centered at (cx, cy), scaled to `size` pixels tall/wide.
// Returns the two line segments for reuse.
function vSegments(cx, cy, size) {
  const topY = cy - size * 0.44;
  const botY = cy + size * 0.44;
  const lx   = cx - size * 0.38;
  const rx   = cx + size * 0.38;
  return [
    [lx, topY, cx, botY],
    [rx, topY, cx, botY],
  ];
}

// ── Asset generators ──────────────────────────────────────────────────────────

// Square icon at `size`×`size` with rounded-rect card bg and V letter.
function makeIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  fill(pixels, size, size, BG);

  const pad    = Math.round(size * 0.055);
  const radius = Math.round(size * 0.22);
  roundRect(pixels, size, size, pad, pad, size - pad * 2, size - pad * 2, radius, CARD_BG);

  const halfT = size * 0.068;
  drawLines(pixels, size, size, vSegments(size / 2, size / 2, size * 0.52), EMERALD, halfT);

  return encodePNG(size, size, pixels);
}

// Adaptive icon foreground: V on fully transparent background.
// Android crops to a circle/squircle, safe zone = inner 66% of area.
function makeAdaptiveIcon(size) {
  const pixels = new Uint8Array(size * size * 4); // all transparent
  const safe   = size * 0.45; // stay comfortably within safe zone
  const halfT  = size * 0.068;
  drawLines(pixels, size, size, vSegments(size / 2, size / 2, safe), EMERALD, halfT);
  return encodePNG(size, size, pixels);
}

// Splash: dark bg + centered icon box.
function makeSplash(w, h) {
  const pixels = new Uint8Array(w * h * 4);
  fill(pixels, w, h, BG);

  const boxSize  = Math.round(Math.min(w, h) * 0.175);
  const bx       = Math.round(w / 2 - boxSize / 2);
  const by       = Math.round(h / 2 - boxSize / 2 - h * 0.015);
  const bRadius  = Math.round(boxSize * 0.22);
  roundRect(pixels, w, h, bx, by, boxSize, boxSize, bRadius, CARD_BG);

  const cx = w / 2;
  const cy = by + boxSize / 2;
  const halfT = boxSize * 0.068;
  drawLines(pixels, w, h, vSegments(cx, cy, boxSize * 0.52), EMERALD, halfT);

  return encodePNG(w, h, pixels);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
fs.mkdirSync(ASSETS_DIR, { recursive: true });

const tasks = [
  { file: 'favicon.png',       label: '64×64  browser favicon',                   gen: () => makeIcon(64) },
  { file: 'icon.png',          label: '1024×1024  app icon (iOS + Android)',        gen: () => makeIcon(1024) },
  { file: 'adaptive-icon.png', label: '1024×1024  adaptive icon (transparent bg)', gen: () => makeAdaptiveIcon(1024) },
  { file: 'splash.png',        label: '1284×2778  splash screen',                  gen: () => makeSplash(1284, 2778) },
];

console.log('Generating Valuta brand assets...\n');

for (const { file, label, gen } of tasks) {
  process.stdout.write(`  ${file.padEnd(22)} ${label} ... `);
  const buf = gen();
  fs.writeFileSync(path.join(ASSETS_DIR, file), buf);
  const kb = (buf.length / 1024).toFixed(0);
  console.log(`${kb} KB`);
}

console.log('\nDone. Files written to assets/');
