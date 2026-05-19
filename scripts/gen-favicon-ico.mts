/**
 * One-shot generator: writes a 32×32 favicon.ico to src/app/favicon.ico.
 *
 * Why this exists: the museum has src/app/icon.svg (the modern, gradient
 * refresh-icon glyph) which most browsers honor via the auto-emitted
 * <link rel="icon" type="image/svg+xml">. But the bare URL /favicon.ico
 * is still probed by:
 *   - Some incognito sessions and private-browsing modes
 *   - Link-preview unfurlers (Slack, Discord, Twitter, iMessage)
 *   - RSS readers and feed aggregators
 *   - Certain browser extensions
 *   - Windows Explorer when a URL is dragged to the desktop
 * — none of which parse <link rel="icon"> from the HTML head reliably.
 * Without a real favicon.ico, those clients log a 404 every visit.
 *
 * We can't easily rasterize the gradient SVG to ICO without a native
 * image dep, so the favicon here is a flat-color stamp using the SVG's
 * gradient midpoint (oklch interpolation of #3b82f6 → #22c55e ≈ teal).
 * Browser tabs that already accept the SVG won't see this. Tab fallbacks
 * + link unfurlers will see the flat stamp, which is identifiable and
 * loads in <1KB.
 *
 * Usage (one-time, then commit the .ico binary):
 *   pnpm tsx scripts/gen-favicon-ico.mts
 *
 * If the museum brand changes, edit the BG/FG hex constants below and
 * re-run.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, "..", "src", "app", "favicon.ico");

// Midpoint of the SVG gradient stops #3b82f6 → #22c55e, eyeballed in oklch
// space then rounded to a near-teal that reads as the gradient's average.
// Stored as 0xAARRGGBB-equivalent components for BMP encoding (BGRA in file).
const BG = { r: 0x2e, g: 0xa3, b: 0xa8, a: 0xff }; // teal stamp
const FG = { r: 0xff, g: 0xff, b: 0xff, a: 0xff }; // white inner glyph

const SIZE = 32;
const STRIDE = SIZE * 4; // BGRA bytes per row

/* Render a tiny round-rect "stamp" so a 32px tab is identifiable without
   recreating the gradient/curves. Filled background + a centered 12px white
   square as a placeholder glyph. Good enough for fallback use. */
function buildPixels(): Buffer {
  const pixels = Buffer.alloc(SIZE * SIZE * 4, 0);
  // BMPs are stored bottom-up. We write top-down here and reverse at the end.
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cornerRadius = 6;
      const inCorner =
        (x < cornerRadius && y < cornerRadius && (cornerRadius - x) ** 2 + (cornerRadius - y) ** 2 > cornerRadius ** 2) ||
        (x >= SIZE - cornerRadius && y < cornerRadius && (x - (SIZE - cornerRadius - 1)) ** 2 + (cornerRadius - y) ** 2 > cornerRadius ** 2) ||
        (x < cornerRadius && y >= SIZE - cornerRadius && (cornerRadius - x) ** 2 + (y - (SIZE - cornerRadius - 1)) ** 2 > cornerRadius ** 2) ||
        (x >= SIZE - cornerRadius && y >= SIZE - cornerRadius && (x - (SIZE - cornerRadius - 1)) ** 2 + (y - (SIZE - cornerRadius - 1)) ** 2 > cornerRadius ** 2);

      if (inCorner) continue; // transparent (a=0 by default)

      // Inner glyph: 14×14 centered white square
      const inGlyph = x >= 9 && x < 23 && y >= 9 && y < 23;
      const c = inGlyph ? FG : BG;

      const off = (y * SIZE + x) * 4;
      // BMP stores BGRA
      pixels[off + 0] = c.b;
      pixels[off + 1] = c.g;
      pixels[off + 2] = c.r;
      pixels[off + 3] = c.a;
    }
  }
  return pixels;
}

function writeUint16LE(buf: Buffer, offset: number, val: number): void {
  buf.writeUInt16LE(val & 0xffff, offset);
}
function writeUint32LE(buf: Buffer, offset: number, val: number): void {
  buf.writeUInt32LE(val >>> 0, offset);
}

const pixelsTopDown = buildPixels();
// Reverse rows to get bottom-up BMP order
const bmpPixels = Buffer.alloc(pixelsTopDown.length);
for (let y = 0; y < SIZE; y++) {
  pixelsTopDown.copy(bmpPixels, (SIZE - 1 - y) * STRIDE, y * STRIDE, (y + 1) * STRIDE);
}

// BITMAPINFOHEADER (DIB header), 40 bytes
const DIB_HEADER_SIZE = 40;
const dib = Buffer.alloc(DIB_HEADER_SIZE);
writeUint32LE(dib, 0, DIB_HEADER_SIZE);
writeUint32LE(dib, 4, SIZE);
writeUint32LE(dib, 8, SIZE * 2); // height is doubled for ICO (XOR + AND masks)
writeUint16LE(dib, 12, 1); // planes
writeUint16LE(dib, 14, 32); // bpp
writeUint32LE(dib, 16, 0); // BI_RGB
writeUint32LE(dib, 20, bmpPixels.length); // image size
// remaining fields zero

// AND mask: 1 bit per pixel, row-padded to 4 bytes. All zeros = full opacity
// is sourced from the alpha channel, which is what we want.
const andRowBytes = Math.ceil(SIZE / 32) * 4; // 32px → 4 bytes/row
const andMask = Buffer.alloc(andRowBytes * SIZE, 0);

const imageData = Buffer.concat([dib, bmpPixels, andMask]);

// ICONDIR header (6 bytes) + ICONDIRENTRY (16 bytes)
const ICONDIR_SIZE = 6;
const ICONDIRENTRY_SIZE = 16;
const header = Buffer.alloc(ICONDIR_SIZE + ICONDIRENTRY_SIZE);
writeUint16LE(header, 0, 0); // reserved
writeUint16LE(header, 2, 1); // type = ICO
writeUint16LE(header, 4, 1); // image count

// ICONDIRENTRY
writeUint16LE(header, ICONDIR_SIZE + 0, SIZE === 256 ? 0 : SIZE); // width
writeUint16LE(header, ICONDIR_SIZE + 1, SIZE === 256 ? 0 : SIZE); // height
header[ICONDIR_SIZE + 2] = 0; // color count (0 = >=256)
header[ICONDIR_SIZE + 3] = 0; // reserved
writeUint16LE(header, ICONDIR_SIZE + 4, 1); // planes
writeUint16LE(header, ICONDIR_SIZE + 6, 32); // bpp
writeUint32LE(header, ICONDIR_SIZE + 8, imageData.length); // image size
writeUint32LE(header, ICONDIR_SIZE + 12, ICONDIR_SIZE + ICONDIRENTRY_SIZE); // offset

const ico = Buffer.concat([header, imageData]);
writeFileSync(out, ico);
console.log(`wrote ${ico.length} bytes → ${out}`);
