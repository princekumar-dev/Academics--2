import { useState, useEffect } from 'react'

export default function useIntersectionObserver(ref, options = {}) {
  const [entry, setEntry] = useState(null)

  useEffect(() => {
    if (!ref || !ref.current) return undefined
    const node = ref.current
    let mounted = true

    const observer = new IntersectionObserver((entries) => {
      if (!mounted) return
      setEntry(entries[0])
    }, options)

    observer.observe(node)

    return () => {
      mounted = false
      try { observer.unobserve(node) } catch (e) {}
      try { observer.disconnect() } catch (e) {}
    }
  }, [ref, JSON.stringify(options)])

  return entry
}
