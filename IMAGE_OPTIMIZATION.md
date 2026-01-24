Image optimization and conversion
================================

This project prefers serving AVIF/WebP fallbacks for images and using responsive `srcset` when available.

Quick workflow (recommended):

1. Install `sharp` (Node) locally or use an image pipeline in CI:

   npm install --save-dev sharp

2. Example Node script to generate AVIF/WebP variants (place under `scripts/`):

```js
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const srcDir = path.resolve(process.cwd(), 'public', 'images')
const files = fs.readdirSync(srcDir).filter(f => /\.(png|jpe?g)$/i.test(f))
const widths = [64, 128, 320, 640, 1024]

async function convert() {
  for (const file of files) {
    const name = file.replace(/\.(png|jpe?g)$/i, '')
    const absolute = path.join(srcDir, file)
    for (const w of widths) {
      await sharp(absolute).resize(w).toFile(path.join(srcDir, `${name}-${w}.avif`))
      await sharp(absolute).resize(w).jpeg({quality:80}).toFile(path.join(srcDir, `${name}-${w}.webp`))
    }
    // also save single-file avif/webp without width suffix
    await sharp(absolute).toFile(path.join(srcDir, `${name}.avif`))
    await sharp(absolute).toFile(path.join(srcDir, `${name}.webp`))
  }
}

convert().catch(e => { console.error(e); process.exit(1) })
```

3. After generating variants, the `ResponsiveImage` component will pick AVIF/WebP fallbacks by replacing extensions and/or using `-<width>` suffixed files when available.

Notes:
- Keep source originals in `public/images/` and add generated files to `.gitignore` if you prefer generating in CI.
- You can adapt widths and quality in the script to match performance goals.
