// Placeholder PWA icons (a bone-colored "R" on the app background).
// Replace the generated PNGs in public/icons with real brand artwork when available.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const BG = '#08080A'
const FG = '#EDEBE6'

const svg = (size, padding) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="${BG}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Arial Black, sans-serif" font-weight="900"
        font-size="${Math.round((size - padding * 2) * 0.62)}" fill="${FG}">R</text>
</svg>`

const targets = [
  ['icon-192.png', 192, 12],
  ['icon-512.png', 512, 32],
  // Maskable icons need a larger safe zone: the OS crops the edges.
  ['icon-maskable-512.png', 512, 96],
  ['apple-touch-icon.png', 180, 12],
]

await mkdir('public/icons', { recursive: true })
for (const [file, size, padding] of targets) {
  await sharp(Buffer.from(svg(size, padding))).png().toFile(`public/icons/${file}`)
  console.log('wrote', file)
}
