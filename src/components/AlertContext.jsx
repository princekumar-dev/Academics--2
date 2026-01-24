import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import GlassAlert from './GlassAlert'

const AlertContext = createContext()

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([])

  const showAlert = useCallback(({
    type = 'info',
    title,
    message,
    duration = 5000,
    position = 'top-right',
    autoClose = true
  }) => {
    const id = Date.now() + Math.random()
    setAlerts(prev => [...prev, { id, type, title, message, duration, position, autoClose }])
    return id
  }, [])

  const hideAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }, [])

  const showSuccess = useCallback((title, message, options = {}) => {
    return showAlert({ type: 'success', title, message, ...options })
  }, [showAlert])

  const showError = useCallback((title, message, options = {}) => {
    return showAlert({ type: 'error', title, message, ...options })
  }, [showAlert])

  const showWarning = useCallback((title, message, options = {}) => {
    return showAlert({ type: 'warning', title, message, ...options })
  }, [showAlert])

  const showInfo = useCallback((title, message, options = {}) => {
    return showAlert({ type: 'info', title, message, ...options })
  }, [showAlert])

  // Listen for service-worker reload requests and show a gentle reload toast
  useEffect(() => {
    const handler = (e) => {
      try {
        const reason = e?.detail?.reason || '';
        let alertId = null;
        const reload = () => {
          try { window.location.reload(); } catch (err) { /* ignore */ }
          if (alertId) hideAlert(alertId);
        };

        const message = (
          <div className="flex items-center gap-3">
            <span>New version available — reload to apply the update.</span>
            <button onClick={reload} className="ml-3 px-3 py-1 bg-blue-600 text-white rounded-md text-xs">Reload</button>
          </div>
        );

        alertId = showInfo('Update available', message, { autoClose: false, duration: 0, position: 'top-right' });
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('sw:reload-request', handler);
    return () => window.removeEventListener('sw:reload-request', handler);
  }, [showInfo, hideAlert]);

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert, showSuccess, showError, showWarning, showInfo }}>
      {children}
      {/* Render all active alerts */}
      {alerts.map(alert => (
        <GlassAlert
          key={alert.id}
          type={alert.type}
          title={alert.title}
          message={alert.message}
          duration={alert.duration}
          position={alert.position}
          autoClose={alert.autoClose}
          onClose={() => hideAlert(alert.id)}
        />
      ))}
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider')
  }
  return context
}
