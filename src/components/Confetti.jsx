import { useEffect, useMemo, useState, useCallback } from 'react'

export function Confetti({
  duration = 3000,
  onComplete,
  count = 80,
  colors = ['#fbbf24', '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'],
  size = 6,
  zIndex = 50
}) {
  const [pieces, setPieces] = useState([])

  useEffect(() => {
    // Generate confetti pieces
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const newPieces = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: prefersReducedMotion ? 0.01 : (2 + Math.random() * 2),
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      radius: Math.random() < 0.5 ? 0 : 50, // 0=square, 50=circle
      drift: (Math.random() - 0.5) * 50 // horizontal drift in px
    }))
    
    setPieces(newPieces)

    const timer = setTimeout(() => {
      onComplete?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, count])

  const keyframesStyle = useMemo(() => `
    @keyframes confetti-fall {
      0% {
        transform: translate3d(0, 0, 0) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translate3d(var(--drift), 100vh, 0) rotate(720deg);
        opacity: 0;
      }
    }

    .confetti-piece {
      animation: confetti-fall linear forwards;
      will-change: transform, opacity;
    }
  `, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex }}>
      <style>{keyframesStyle}</style>
      {pieces.map(piece => (
        <div
          key={piece.id}
          className="absolute confetti-piece"
          style={{
            left: `${piece.left}%`,
            top: '-10px',
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            transform: `rotate(${piece.rotation}deg)`,
            width: size,
            height: size,
            borderRadius: `${piece.radius}%`,
            '--drift': `${piece.drift}px`
          }}
        />
      ))}
    </div>
  )
}

// Hook for triggering confetti
export function useConfetti() {
  const [showConfetti, setShowConfetti] = useState(false)

  const celebrate = useCallback(() => {
    setShowConfetti(true)
  }, [])

  const ConfettiContainer = useCallback(() => (
    <>
      {showConfetti && (
        <Confetti onComplete={() => setShowConfetti(false)} />
      )}
    </>
  ), [showConfetti])

  return { celebrate, ConfettiContainer }
}
