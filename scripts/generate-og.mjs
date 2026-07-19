/**
 * Generate the 1200×630 Open Graph card at static/og.png from an inline SVG.
 * Re-runnable: `node scripts/generate-og.mjs` (sharp renders the SVG; system
 * font stack, no external assets). Referenced by Seo.svelte as the default
 * og:image / twitter:image.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Palette: app dark theme (--bg #0b1220, text #e6edf5, muted #9fb0c3) with the
// accent from layout.css' accent scale (light-mode --accent = accent-600).
const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0b1220"/>
  <rect x="0" y="0" width="1200" height="6" fill="#0e7490"/>
  <g font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">
    <text x="96" y="180" font-size="34" fill="#9fb0c3" letter-spacing="6">UNIVERSAL-CONVERTER.ORG</text>
    <text x="96" y="292" font-size="84" font-weight="700" fill="#e6edf5">Universal Converter</text>
    <text x="96" y="378" font-size="38" fill="#9fb0c3">Transparent conversions for units, energy,</text>
    <text x="96" y="430" font-size="38" fill="#9fb0c3">fuels and emissions.</text>
    <g font-size="26">
      <rect x="96" y="486" width="118" height="52" rx="26" fill="none" stroke="#0e7490" stroke-width="2"/>
      <text x="155" y="520" text-anchor="middle" fill="#67e8f9">exact</text>
      <rect x="238" y="486" width="204" height="52" rx="26" fill="none" stroke="#35485f" stroke-width="2"/>
      <text x="340" y="520" text-anchor="middle" fill="#9fb0c3">source-based</text>
      <rect x="466" y="486" width="170" height="52" rx="26" fill="none" stroke="#35485f" stroke-width="2"/>
      <text x="551" y="520" text-anchor="middle" fill="#9fb0c3">estimate</text>
      <text x="676" y="520" fill="#5b6672">— never conflated</text>
    </g>
  </g>
</svg>`;

const out = join(root, 'static', 'og.png');
await sharp(Buffer.from(svg)).png().toFile(out);
const meta = await sharp(out).metadata();
console.log(`wrote ${out}: ${meta.width}x${meta.height} png`);
if (meta.width !== 1200 || meta.height !== 630) {
	throw new Error('unexpected og.png dimensions');
}
