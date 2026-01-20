import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

export function Tooltip({ content, children, position = 'top' }) {
  const [isVisible, setIsVisible] = useState(false)

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children}
      </div>
      
      {isVisible && (
        <div 
          className={`absolute ${positions[position]} z-50 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg whitespace-nowrap shadow-lg animate-fade-in`}
          role="tooltip"
        >
          {content}
          <div className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 
            ${position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' : ''}
            ${position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' : ''}
            ${position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' : ''}
            ${position === 'right' ? 'left-[-4px] top-1/2 -translate-y-1/2' : ''}
          `} />
        </div>
      )}
    </div>
  )
}

export function HelpTooltip({ content, position = 'top' }) {
  return (
    <Tooltip content={content} position={position}>
      <button 
        className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
        type="button"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}

// Guided tour component
export function GuidedTour({ steps, onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible || !steps || steps.length === 0) return null

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  const handleNext = () => {
    if (isLastStep) {
      setIsVisible(false)
      onComplete?.()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleSkip = () => {
    setIsVisible(false)
    onSkip?.()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" />
      
      {/* Tour popup */}
      <div 
        className="fixed z-50 bg-white rounded-2xl shadow-2xl p-6 max-w-md animate-scale-in"
        style={{
          top: step.position?.top || '50%',
          left: step.position?.left || '50%',
          transform: 'translate(-50%, -50%)'
        }}
      >
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="mb-4">
          {step.icon && (
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              {step.icon}
            </div>
          )}
          <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
          <p className="text-gray-600">{step.description}</p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep ? 'bg-yellow-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Skip Tour
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-semibold transition-colors"
            >
              {isLastStep ? 'Got It!' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
