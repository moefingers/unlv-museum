import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
// @ts-expect-error - png-to-ico has no types
import pngToIco from "png-to-ico";

// Rasterizes src/app/icon.svg into a multi-resolution favicon.ico.
// The live icon.svg uses var(--edge) + oklch() which librsvg can't resolve,
// so we ship a static variant with Full-Stack blue (#3b82f6) baked in.
// Background is transparent per user preference.
const STATIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <defs>
    <radialGradient id="core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="35%" stop-color="#93c5fd" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.85"/>
    </radialGradient>
  </defs>
  <polygon points="12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7" stroke="url(#core)" stroke-width="1.6" fill="none"/>
  <polygon points="12,2 20.66,17 3.34,17" stroke="url(#core)" stroke-width="1.4" fill="none"/>
</svg>`;

const SIZES = [16, 32, 48];
const OUT = join(process.cwd(), "src/app/favicon.ico");

async function main() {
  const svgBuf = Buffer.from(STATIC_SVG);
  const pngs = await Promise.all(
    SIZES.map((size) =>
      sharp(svgBuf, { density: 384 })
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );
  const ico = await pngToIco(pngs);
  await writeFile(OUT, ico);
  console.log(`wrote ${OUT} (${SIZES.join("/")}px, ${ico.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
