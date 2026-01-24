import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const imagesDir = path.resolve(process.cwd(), 'public', 'images')
const widths = [64, 128, 256, 320, 640, 1024]

function isSourceImage(name) {
  // skip already generated variants (files that contain -<width>.<ext> or already avif/webp)
  if (/-\d+\.(avif|webp)$/i.test(name)) return false
  if (/\.(avif|webp)$/i.test(name)) return false
  return /\.(png|jpe?g)$/i.test(name)
}

async function convertFile(file) {
  try {
    const absolute = path.join(imagesDir, file)
    const ext = path.extname(file)
    const base = file.slice(0, -ext.length)

    console.log(`Processing ${file}`)

    // generate resized AVIF and WebP files
    for (const w of widths) {
      const avifOut = path.join(imagesDir, `${base}-${w}.avif`)
      const webpOut = path.join(imagesDir, `${base}-${w}.webp`)
      await sharp(absolute).resize(w).avif({quality: 60}).toFile(avifOut)
      await sharp(absolute).resize(w).webp({quality: 75}).toFile(webpOut)
      console.log(`  wrote ${base}-${w}.avif, ${base}-${w}.webp`)
    }

    // write single-file fallbacks
    const avifSingle = path.join(imagesDir, `${base}.avif`)
    const webpSingle = path.join(imagesDir, `${base}.webp`)
    await sharp(absolute).avif({quality: 60}).toFile(avifSingle)
    await sharp(absolute).webp({quality: 75}).toFile(webpSingle)
    console.log(`  wrote ${base}.avif, ${base}.webp`)
  } catch (err) {
    console.error('Error converting', file, err)
  }
}

async function run() {
  if (!fs.existsSync(imagesDir)) {
    console.error('Images dir not found:', imagesDir)
    process.exit(1)
  }

  const files = fs.readdirSync(imagesDir).filter(isSourceImage)
  if (files.length === 0) {
    console.log('No source PNG/JPEG images found to convert.')
    return
  }

  console.log('Found', files.length, 'images to convert')
  for (const f of files) {
    // skip tiny icons
    const stats = fs.statSync(path.join(imagesDir, f))
    if (stats.size < 1024) {
      console.log('  skipping small file', f)
      continue
    }
    await convertFile(f)
  }
  console.log('Image conversion complete')
}

run().catch(e => { console.error(e); process.exit(1) })
