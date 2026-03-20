import { useEffect, useCallback, useRef } from 'react'

/**
 * Hook to listen for push notifications from service worker
 * Automatically triggers callbacks when specific notification types are received
 * 
 * Usage:
 * usePushNotifications({
 *   'late_arrival': () => fetchRequests(),
 *   'marksheet_update': () => fetchMarksheets()
 * })
 */
export function usePushNotifications(handlers = {}) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported')
      return
    }

    // Listen for messages from service worker
    const messageListener = (event) => {
      if (!event.data) return
      
      const { type, data } = event.data
      
      if (type === 'NOTIFICATION_RECEIVED' && handlers[data?.notificationType]) {
        console.log(`📲 Push notification received: ${data.notificationType}`)
        console.log('   Triggering refresh handler...')
        handlers[data.notificationType](data)
      }
    }

    navigator.serviceWorker.addEventListener('message', messageListener)

    return () => {
      navigator.serviceWorker.removeEventListener('message', messageListener)
    }
  }, [handlers])
}

/**
 * Hook to trigger automatic refresh when page comes into focus
 * Includes debouncing and minimum interval to prevent excessive requests
 */
export function usePageFocus(callback, minIntervalMs = 30000) {
  const lastCallTimeRef = useRef(0);
  const callbackRef = useRef(callback);
  
  // Update callback ref when callback changes, but don't re-register listener
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTimeRef.current;
        
        // Only call if minimum interval has passed
        if (timeSinceLastCall >= minIntervalMs) {
          console.log('📱 Page came into focus, refreshing data...')
          lastCallTimeRef.current = now;
          callbackRef.current?.();
        } else {
          console.log(`📱 Page came into focus, but skipping refresh (${Math.round(minIntervalMs - timeSinceLastCall)}ms until next allowed)`)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [minIntervalMs])
}
