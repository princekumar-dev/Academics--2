import { useRef } from 'react'
import useIntersectionObserver from '../hooks/useIntersectionObserver'

export default function LazyLoad({ children, fallback = null, rootMargin = '200px', threshold = 0 }) {
  const ref = useRef(null)
  const entry = useIntersectionObserver(ref, { root: null, rootMargin, threshold })
  const isVisible = !!entry?.isIntersecting

  return (
    <div ref={ref} className="lazy-load-root">
      {isVisible ? children : (fallback || null)}
    </div>
  )
}
