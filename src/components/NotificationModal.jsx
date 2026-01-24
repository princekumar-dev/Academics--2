import { useEffect } from 'react'

// Confirmation Dialog Component
export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger' }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const typeStyles = {
    danger: {
      button: 'bg-red-600 hover:bg-red-700',
      icon: '⚠️',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600'
    },
    warning: {
      button: 'bg-yellow-600 hover:bg-yellow-700',
      icon: '⚠️',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600'
    },
    info: {
      button: 'bg-blue-600 hover:bg-blue-700',
      icon: 'ℹ️',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    }
  }

  const style = typeStyles[type] || typeStyles.danger

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm no-mobile-backdrop"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slideUp">
        {/* Icon */}
        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${style.iconBg} mb-4`}>
          <span className={`text-2xl ${style.iconColor}`}>{style.icon}</span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          {title}
        </h3>

        {/* Message */}
        <p className="text-gray-600 text-center mb-6">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors duration-200"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`flex-1 px-4 py-2.5 ${style.button} text-white font-medium rounded-lg transition-colors duration-200 shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// Toast Notification Component
export function Toast({ isOpen, onClose, message, type = 'success', duration = 3000 }) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [isOpen, duration, onClose])

  if (!isOpen) return null

  const typeStyles = {
    success: {
      bg: 'bg-green-500',
      icon: '✓',
      progressBar: 'bg-green-700'
    },
    error: {
      bg: 'bg-red-500',
      icon: '✕',
      progressBar: 'bg-red-700'
    },
    warning: {
      bg: 'bg-yellow-500',
      icon: '⚠',
      progressBar: 'bg-yellow-700'
    },
    info: {
      bg: 'bg-blue-500',
      icon: 'ℹ',
      progressBar: 'bg-blue-700'
    }
  }

  const style = typeStyles[type] || typeStyles.success

  return (
    <div className="notification-container notification-top-right">
      <div className={`${style.bg} text-white px-4 sm:px-6 py-3 sm:py-4 
                     rounded-xl sm:rounded-2xl shadow-2xl 
                     max-w-sm sm:max-w-md w-full
                     flex items-center gap-3 relative overflow-hidden
                     backdrop-blur-sm border border-white/10
                     notification-interactive transform-gpu`}>
        {/* Enhanced Icon */}
        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 
                      flex items-center justify-center 
                      bg-white/20 rounded-full font-bold text-sm sm:text-base
                      backdrop-blur-sm">
          {style.icon}
        </div>

        {/* Enhanced Message */}
        <p className="flex-1 font-medium text-sm sm:text-base leading-relaxed pr-2">
          {message}
        </p>

        {/* Enhanced Close button */}
        <button
          onClick={onClose}
          className="flex-shrink-0 text-white/80 hover:text-white
                   hover:bg-white/20 active:bg-white/30 
                   rounded-lg p-1.5 transition-all duration-200
                   hover:scale-110 active:scale-95
                   touch-manipulation"
          style={{ touchAction: 'manipulation' }}
          aria-label="Close notification"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Enhanced Progress bar */}
        {duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 sm:h-1.5 
                        bg-white/20 rounded-b-xl sm:rounded-b-2xl overflow-hidden">
            <div 
              className={`h-full ${style.progressBar} shadow-sm`}
              style={{
                animation: `shrink ${duration}ms linear forwards`
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Alert Dialog (non-blocking, like alert but styled)
export function AlertDialog({ isOpen, onClose, title, message, type = 'info' }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const typeStyles = {
    success: {
      icon: '✓',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700'
    },
    error: {
      icon: '✕',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700'
    },
    warning: {
      icon: '⚠',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700'
    },
    info: {
      icon: 'ℹ',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700'
    }
  }

  const style = typeStyles[type] || typeStyles.info

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm no-mobile-backdrop"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slideUp">
        {/* Icon */}
        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${style.iconBg} mb-4`}>
          <span className={`text-2xl ${style.iconColor} font-bold`}>{style.icon}</span>
        </div>

        {/* Title */}
        {title && (
          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
            {title}
          </h3>
        )}

        {/* Message */}
        <p className="text-gray-600 text-center mb-6">
          {message}
        </p>

        {/* Button */}
        <button
          onClick={onClose}
          className={`w-full px-4 py-2.5 ${style.button} text-white font-medium rounded-lg transition-colors duration-200 shadow-lg`}
        >
          OK
        </button>
      </div>
    </div>
  )
}
