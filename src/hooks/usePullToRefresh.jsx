import { useState, useEffect, useRef } from 'react'

/**
 * usePullToRefresh - Custom hook for implementing pull-to-refresh gesture
 * 
 * @param {Function} onRefresh - Callback function to execute when refresh is triggered
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Distance in pixels to trigger refresh (default: 80)
 * @param {boolean} options.enabled - Whether pull-to-refresh is enabled (default: true)
 * @returns {Object} - { isPulling, pullDistance, containerRef }
 */
export function usePullToRefresh(onRefresh, options = {}) {
  const {
    threshold = 80,
    enabled = true
  } = options

  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [startY, setStartY] = useState(0)
  const containerRef = useRef(null)

  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const thresholdRef = useRef(threshold)
  thresholdRef.current = threshold

  const stateRef = useRef({ isPulling, isRefreshing, pullDistance })
  stateRef.current = { isPulling, isRefreshing, pullDistance }

  useEffect(() => {
    if (!enabled || !containerRef.current) return

    const container = containerRef.current
    let touchStartY = 0
    let touchStartX = 0
    let isPullingDownLocal = false

    const handleTouchStart = (e) => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
      const isAtTop = scrollTop <= 5 // slightly more lenient

      if (!isAtTop || stateRef.current.isRefreshing) {
        return
      }

      touchStartY = e.touches[0].clientY
      touchStartX = e.touches[0].clientX
      isPullingDownLocal = false
    }

    const handleTouchMove = (e) => {
      if (stateRef.current.isRefreshing) return

      const touchY = e.touches[0].clientY
      const touchX = e.touches[0].clientX
      const deltaY = touchY - touchStartY
      const deltaX = Math.abs(touchX - touchStartX)

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
      const isAtTop = scrollTop <= 5

      if (isAtTop && deltaY > 0 && deltaY > deltaX * 2) {
        isPullingDownLocal = true

        if (deltaY > 10 && e.cancelable) {
          e.preventDefault()
        }

        setIsPulling(true)
        const resistance = 0.35
        const adjustedDistance = Math.min(deltaY * resistance, thresholdRef.current * 1.5)
        setPullDistance(adjustedDistance)
      } else if (isPullingDownLocal) {
        setIsPulling(false)
        setPullDistance(0)
        isPullingDownLocal = false
      }
    }

    const handleTouchEnd = async () => {
      if (!isPullingDownLocal || stateRef.current.isRefreshing) {
        setIsPulling(false)
        setPullDistance(0)
        isPullingDownLocal = false
        return
      }

      const currentPullDistance = stateRef.current.pullDistance
      setIsPulling(false)
      isPullingDownLocal = false

      if (currentPullDistance >= thresholdRef.current) {
        setIsRefreshing(true)
        setPullDistance(thresholdRef.current)

        try {
          await onRefreshRef.current()
        } catch (error) {
          console.error('Pull-to-refresh error:', error)
        } finally {
          setIsRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [enabled])

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    containerRef,
    threshold
  }
}

/**
 * PullToRefreshIndicator - Visual indicator component for pull-to-refresh
 * Shows animated spinner and pull progress
 */
export function PullToRefreshIndicator({ pullDistance, threshold, isRefreshing }) {
  const progress = Math.min((pullDistance / threshold) * 100, 100)
  const opacity = Math.min(pullDistance / threshold, 1)
  const rotation = (pullDistance / threshold) * 360

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200 md:hidden"
      style={{
        height: `${pullDistance}px`,
        opacity: opacity,
        pointerEvents: 'none'
      }}
    >
      <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg">
        {isRefreshing ? (
          // Spinning loader during refresh
          <svg
            className="w-6 h-6 text-theme-gold animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          // Down arrow with rotation based on pull distance
          <svg
            className="w-6 h-6 text-theme-gold transition-transform duration-200"
            style={{ transform: `rotate(${rotation}deg)` }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        )}
      </div>
    </div>
  )
}

export default usePullToRefresh
