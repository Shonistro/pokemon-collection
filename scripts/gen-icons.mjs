// Generates PWA/favicon assets from a single square source image into public/.
// Usage: node scripts/gen-icons.mjs [sourceImage.png]
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const src = process.argv[2] || 'Gemini_Generated_Image_cpq5g2cpq5g2cpq5.png';
mkdirSync('public', { recursive: true });

const targets = [
  ['public/pwa-192x192.png', 192],
  ['public/pwa-512x512.png', 512],
  ['public/maskable-512x512.png', 512],
  ['public/apple-touch-icon.png', 180],
  ['public/favicon-32x32.png', 32],
  ['public/favicon-16x16.png', 16],
];

for (const [out, size] of targets) {
  await sharp(src)
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: '#000000' }) // opaque (Apple icons dislike alpha)
    .png()
    .toFile(out);
  console.log('wrote', out, `${size}x${size}`);
}
