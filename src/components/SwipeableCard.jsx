import { useState, useRef, useEffect } from 'react'

/**
 * SwipeableCard - A wrapper component that enables swipe gestures on marksheet cards
 * Swipe left to reveal quick action buttons (View, Approve, Reject)
 * 
 * Props:
 * - children: Card content to display
 * - actions: Array of action objects {label, icon, onClick, className}
 * - onSwipe: Optional callback when swipe is triggered
 */
function SwipeableCard({ children, actions = [], onSwipe }) {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const currentX = useRef(0)
  const containerRef = useRef(null)

  const SWIPE_THRESHOLD = 50 // Minimum swipe distance to trigger
  const MAX_SWIPE = 200 // Maximum swipe distance (for vertical buttons)
  const ACTION_WIDTH = 200 // Width of action buttons

  useEffect(() => {
    // Close swipe when clicking outside
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target) && isRevealed) {
        closeSwipe()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isRevealed])

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsSwiping(true)
  }

  const handleTouchMove = (e) => {
    if (!isSwiping) return

    const touchX = e.touches[0].clientX
    const touchY = e.touches[0].clientY
    const deltaX = touchX - touchStartX.current
    const deltaY = touchY - touchStartY.current

    // Only treat this as a horizontal swipe if horizontal movement is
    // clearly larger than vertical movement and exceeds a small threshold.
    // Avoid calling preventDefault() entirely; rely on `touch-action: pan-y`
    // on the swipeable element so the browser handles vertical scrolling.
    const HORIZONTAL_MIN = 10
    const isHorizontalSwipe = Math.abs(deltaX) > HORIZONTAL_MIN && Math.abs(deltaX) > Math.abs(deltaY) * 1.5
    if (!isHorizontalSwipe) return
      
      // Check if there are actions available for the swipe direction
      const swipeRight = deltaX > 0
      const swipeLeft = deltaX < 0
      const hasRightActions = actions.some(a => a.direction === 'right')
      const hasLeftActions = actions.some(a => a.direction !== 'right')
      
      // Only allow swipe if there are actions in that direction
      if ((swipeRight && !hasRightActions) || (swipeLeft && !hasLeftActions)) {
        return
      }
      
      // Allow both left (negative) and right (positive) swipe
      let newOffset = Math.max(Math.min(deltaX, MAX_SWIPE), -MAX_SWIPE)
      currentX.current = newOffset
      setSwipeOffset(newOffset)
  }

  const handleTouchEnd = () => {
    setIsSwiping(false)

    // If swiped past threshold, reveal actions or auto-trigger
    if (Math.abs(currentX.current) > SWIPE_THRESHOLD) {
      // Determine direction: positive = right, negative = left
      const swipeRight = currentX.current > 0
      const relevantActions = actions.filter(a => swipeRight ? a.direction === 'right' : a.direction !== 'right')
      
      // If right swipe and there's an autoTrigger action, execute it immediately
      if (swipeRight && relevantActions.some(a => a.autoTrigger)) {
        const autoAction = relevantActions.find(a => a.autoTrigger)
        if (autoAction) {
          closeSwipe()
          if (autoAction.onClick) autoAction.onClick()
          return
        }
      }
      
      // Otherwise, reveal the actions
      const revealWidth = Math.min(relevantActions.length * ACTION_WIDTH, MAX_SWIPE)
      const newOffset = swipeRight ? revealWidth : -revealWidth
      setSwipeOffset(newOffset)
      setIsRevealed(true)
      if (onSwipe) onSwipe()
    } else {
      closeSwipe()
    }
  }

  const closeSwipe = () => {
    setSwipeOffset(0)
    setIsRevealed(false)
    currentX.current = 0
  }

  const handleActionClick = (action) => {
    closeSwipe()
    if (action.onClick) {
      action.onClick()
    }
  }

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden rounded-xl shadow-sm border border-gray-200"
      style={{ 
        touchAction: 'pan-y',
        transform: 'translateZ(0)', /* Force GPU acceleration */
        willChange: isSwiping ? 'transform' : 'auto'
      }}
    >
      {/* Action buttons - Left swipe actions (right side) */}
      <div className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-3 py-3 z-0" style={{ width: '200px' }}>
        {actions.filter(a => a.direction !== 'right').map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleActionClick(action)}
            className={`flex items-center justify-center gap-2 px-6 py-3 font-semibold transition-all duration-200 text-sm rounded-lg shadow-md hover:shadow-lg active:scale-95 ${
              action.className || 'border-gray-200 text-gray-600 bg-white'
            }`}
            style={{ 
              minWidth: '140px',
              minHeight: '48px'
            }}
            title={action.label}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Action buttons - Right swipe actions (left side) */}
      <div className="absolute inset-y-0 left-0 flex flex-col items-center justify-center gap-3 py-3 z-0" style={{ width: '200px' }}>
        {actions.filter(a => a.direction === 'right').map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleActionClick(action)}
            className={`flex items-center justify-center gap-2 px-6 py-3 font-semibold transition-all duration-200 text-sm rounded-lg shadow-md hover:shadow-lg active:scale-95 ${
              action.className || 'border-gray-200 text-gray-600 bg-white'
            }`}
            style={{ 
              minWidth: '140px',
              minHeight: '48px'
            }}
            title={action.label}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Card content (swipeable) */}
      <div
        className="relative z-10 bg-white rounded-xl"
        style={{
          transform: `translate3d(${swipeOffset}px, 0, 0)`, /* Use translate3d for GPU acceleration */
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: isSwiping ? 'transform' : 'auto',
          boxShadow: isRevealed ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}

export default SwipeableCard
