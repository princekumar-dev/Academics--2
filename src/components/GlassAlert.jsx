import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export default function GlassAlert({ 
  type = 'info', 
  title, 
  message, 
  onClose, 
  autoClose = true, 
  duration = 5000,
  position = 'top-right' 
}) {
  useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [autoClose, duration, onClose])

  const handleClose = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onClose) {
      onClose()
    }
  }

  const icons = {
    success: <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />,
    info: <Info className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
  }

  const backgroundColors = {
    success: 'bg-gradient-to-br from-green-50 to-emerald-50',
    error: 'bg-gradient-to-br from-red-50 to-rose-50',
    warning: 'bg-gradient-to-br from-amber-50 to-yellow-50',
    info: 'bg-gradient-to-br from-blue-50 to-cyan-50'
  }

  const borderColors = {
    success: 'border-green-300',
    error: 'border-red-300',
    warning: 'border-amber-300',
    info: 'border-blue-300'
  }

  const iconBgColors = {
    success: 'bg-green-100',
    error: 'bg-red-100',
    warning: 'bg-amber-100',
    info: 'bg-blue-100'
  }

  const progressColors = {
    success: 'from-green-500 to-emerald-500',
    error: 'from-red-500 to-rose-500',
    warning: 'from-amber-500 to-yellow-500',
    info: 'from-blue-500 to-cyan-500'
  }

  const positions = {
    'top-right': 'notification-container notification-top-right',
    'top-left': 'notification-container notification-top-left',
    'top-center': 'notification-container notification-top-center',
    'bottom-right': 'notification-container notification-bottom-right',
    'bottom-left': 'notification-container notification-bottom-left',
    'bottom-center': 'notification-container notification-bottom-center',
    'center': 'notification-container notification-center'
  }

  return (
    <div className={`${positions[position]}`}>
      {/* Enhanced Glassmorphism Alert Box */}
      <div 
        role="alert"
        className={`
          notification-card notification-interactive
          relative w-11/12 sm:min-w-[340px] sm:max-w-md 
          rounded-lg sm:rounded-2xl
          ${backgroundColors[type]}
          border-2 ${borderColors[type]}
          p-2.5 sm:p-5
          shadow-xl
          backdrop-blur-md
          transform-gpu
        `}
        style={{
          boxSizing: 'border-box'
        }}
      >
        {/* Enhanced Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={handleClose}
            onTouchEnd={handleClose}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10
                     p-1 sm:p-1.5 rounded-lg
                     bg-white/90 hover:bg-white active:bg-gray-100
                     border border-gray-300
                     transition-all duration-200 
                     hover:scale-110 active:scale-95
                     shadow-md hover:shadow-lg
                     cursor-pointer
                     touch-manipulation"
            aria-label="Close alert"
            style={{ 
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              minWidth: '32px',
              minHeight: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X className="w-4 h-4 sm:w-4 sm:h-4 text-gray-700 stroke-2" />
          </button>
        )}

        {/* Enhanced Alert Content */}
        <div className="flex items-start gap-2.5 sm:gap-4 pr-9 sm:pr-11">
          {/* Enhanced Icon */}
          <div className={`flex-shrink-0 p-1.5 sm:p-2 rounded-lg ${iconBgColors[type]}`}>
            {icons[type]}
          </div>

          {/* Enhanced Text Content */}
          <div className="flex-1 min-w-0 pt-0.5">
            {title && (
              <h3 className="text-gray-900 font-bold text-sm sm:text-base mb-1 
                           break-words leading-tight">
                {title}
              </h3>
            )}
            {message && (
              <p className="text-gray-700 text-xs sm:text-sm leading-relaxed 
                          break-words">
                {message}
              </p>
            )}
          </div>
        </div>

        {/* Enhanced Progress Bar (for auto-close) */}
        {autoClose && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200/50 overflow-hidden"
            style={{ borderRadius: '0 0 12px 12px' }}
          >
            <div 
              className={`h-full bg-gradient-to-r ${progressColors[type]} shadow-sm`}
              style={{
                animation: `progress ${duration}ms linear forwards`,
                transformOrigin: 'left'
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Hook for managing alerts
export function useGlassAlert() {
  const [alerts, setAlerts] = useState([])

  const showAlert = useCallback((alertConfig) => {
    const id = Date.now()
    setAlerts(prev => [...prev, { ...alertConfig, id }])
    return id
  }, [])

  const hideAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }, [])

  const AlertContainer = () => (
    <>
      {alerts.map(alert => (
        <GlassAlert
          key={alert.id}
          {...alert}
          onClose={() => hideAlert(alert.id)}
        />
      ))}
    </>
  )

  return { showAlert, hideAlert, AlertContainer }
}

// React import for the hook
import { useState, useCallback } from 'react'
