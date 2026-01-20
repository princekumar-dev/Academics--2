import { useRef } from 'react'
import LazyLoad from './LazyLoad'

export default function LazyImage({ src, alt = '', className = '', srcSet, sizes, placeholder = null, rootMargin = '200px' }) {
  const imgRef = useRef(null)

  const img = (
    <img
      ref={imgRef}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  )

  return (
    <LazyLoad fallback={placeholder} rootMargin={rootMargin}>
      {img}
    </LazyLoad>
  )
}
