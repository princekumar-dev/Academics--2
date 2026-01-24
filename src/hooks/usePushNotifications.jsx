import { useEffect, useCallback } from 'react'

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
 */
export function usePageFocus(callback) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('📱 Page came into focus, refreshing data...')
        callback?.()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [callback])
}
