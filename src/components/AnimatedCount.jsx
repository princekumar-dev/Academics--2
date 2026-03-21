import { useEffect, useRef, useState } from 'react'

function AnimatedCount({ value, duration = 320, className = '' }) {
  const [displayValue, setDisplayValue] = useState(() => Number(value) || 0)
  const previousValueRef = useRef(Number(value) || 0)

  useEffect(() => {
    const nextValue = Number(value) || 0
    const startValue = previousValueRef.current

    if (nextValue === startValue) return

    let animationFrameId = 0
    const startedAt = performance.now()

    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentValue = Math.round(startValue + ((nextValue - startValue) * eased))
      setDisplayValue(currentValue)

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(tick)
      } else {
        previousValueRef.current = nextValue
      }
    }

    animationFrameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      previousValueRef.current = nextValue
      setDisplayValue(nextValue)
    }
  }, [duration, value])

  return <span className={className}>{displayValue}</span>
}

export default AnimatedCount
