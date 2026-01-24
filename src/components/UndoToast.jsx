import { useState, useEffect } from 'react'
import { X, RotateCcw } from 'lucide-react'

export function UndoToast({ message, onUndo, duration = 5000, onClose }) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          clearInterval(interval)
          onClose?.()
          return 0
        }
        return prev - (100 / (duration / 100))
      })
    }, 100)

    return () => clearInterval(interval)
  }, [duration, onClose])

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl overflow-hidden min-w-[320px] max-w-md">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium">{message}</p>
          </div>
          
          <div className="flex items-center gap-2">
            {onUndo && (
              <button
                onClick={() => {
                  onUndo()
                  onClose?.()
                }}
                className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Undo
              </button>
            )}
            
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-1 bg-white/10">
          <div 
            className="h-full bg-yellow-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// Hook for managing undo toasts
export function useUndoToast() {
  const [toast, setToast] = useState(null)

  const showUndo = (message, undoAction) => {
    setToast({ message, undoAction })
  }

  const hideToast = () => setToast(null)

  const ToastContainer = () => (
    <>
      {toast && (
        <UndoToast
          message={toast.message}
          onUndo={toast.undoAction}
          onClose={hideToast}
        />
      )}
    </>
  )

  return { showUndo, hideToast, ToastContainer }
}

<style jsx>{`
  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translate(-50%, 20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  .animate-slide-up {
    animation: slide-up 0.3s ease-out;
  }
`}</style>
