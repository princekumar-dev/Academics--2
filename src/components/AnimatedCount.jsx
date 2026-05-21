import { useEffect, useRef, useState } from 'react'

/**
 * FlipDigit — renders a single numeric character (0–9 or ',') with a
 * slot-machine flip animation whenever the character changes.
 */
function FlipDigit({ digit, className = '' }) {
  const [current, setCurrent] = useState(digit)
  const [next, setNext] = useState(digit)
  const [flipping, setFlipping] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (digit === current) return

    // Kick off the flip
    setNext(digit)
    setFlipping(true)

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCurrent(digit)
      setFlipping(false)
    }, 280) // must match CSS animation duration

    return () => clearTimeout(timerRef.current)
  }, [digit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Non-numeric separators (comma, dot, space) — render statically
  if (!/\d/.test(digit)) {
    return (
      <span className={`animated-count-sep ${className}`} style={{ display: 'inline-block' }}>
        {digit}
      </span>
    )
  }

  return (
    <span
      className={`animated-count-drum ${className}`}
      style={{
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
        verticalAlign: 'bottom',
        lineHeight: 'inherit',
        minWidth: '0.6em',
        textAlign: 'center'
      }}
      aria-hidden="true"
    >
      {/* current digit — slides out when flipping */}
      <span
        style={{
          display: 'block',
          transition: flipping ? 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease' : 'none',
          transform: flipping ? 'translateY(-100%)' : 'translateY(0)',
          opacity: flipping ? 0 : 1,
        }}
      >
        {current}
      </span>
      {/* next digit — slides in when flipping */}
      {flipping && (
        <span
          style={{
            display: 'block',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: 'translateY(100%)',
            opacity: 0,
            animation: 'flipDigitIn 0.28s cubic-bezier(0.4,0,0.2,1) forwards',
          }}
        >
          {next}
        </span>
      )}
    </span>
  )
}

/**
 * AnimatedCount
 *
 * Renders `value` as a series of individually flipping digits.
 * When value changes (e.g. 28 → 29) only the changed digits animate,
 * giving a premium odometer / slot-machine effect.
 *
 * Props:
 *  value      — number or string to display
 *  className  — optional extra classes on the outer <span>
 *  duration   — kept for API compatibility (unused; animation is CSS-driven)
 */
function AnimatedCount({ value, className = '', duration: _duration }) {
  const displayStr = (Number(value) || 0).toLocaleString('en-IN')

  return (
    <>
      {/* Inject keyframes once */}
      <style>{`
        @keyframes flipDigitIn {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      <span
        className={className}
        style={{ display: 'inline-flex', alignItems: 'baseline' }}
        aria-label={String(value)}
      >
        {displayStr.split('').map((ch, i) => (
          <FlipDigit key={i} digit={ch} />
        ))}
      </span>
    </>
  )
}

export default AnimatedCount
