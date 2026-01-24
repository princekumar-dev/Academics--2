import React from 'react'

// ResponsiveImage: renders a <picture> with AVIF/WebP fallbacks and a PNG/JPG fallback.
// Props:
// - src: string - path to the default image (e.g. '/images/mseclogo.png')
// - alt, className, sizes, widths (array of ints), lazy (bool)
export default function ResponsiveImage({ src, alt = '', className = '', sizes = '100vw', widths = null, lazy = true }) {
  if (!src) return null

  const lastDot = src.lastIndexOf('.')
  const base = lastDot === -1 ? src : src.slice(0, lastDot)

  const makeSrcSet = (fmt) => {
    if (Array.isArray(widths) && widths.length > 0) {
      return widths.map(w => `${base}-${w}.${fmt} ${w}w`).join(', ')
    }
    // Fallback to single-file replacement (e.g. /images/mseclogo.avif)
    return `${base}.${fmt}`
  }

  const avifSrcSet = makeSrcSet('avif')
  const webpSrcSet = makeSrcSet('webp')

  return (
    <picture className={className}>
      <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
      <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
      <img src={src} alt={alt} loading={lazy ? 'lazy' : 'eager'} decoding="async" style={{width:'100%',height:'100%',objectFit:'contain'}} />
    </picture>
  )
}
