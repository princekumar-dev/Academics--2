import { useState, useEffect } from 'react'
import { 
  initNotifications, 
  requestNotificationPermission, 
  subscribeToNotifications,
  unsubscribeFromNotifications,
  showNotification,
  isNotificationSupported,
  getNotificationPermission
} from '../utils/notifications'

function NotificationSettings() {
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkNotificationStatus()
  }, [])

  const checkNotificationStatus = () => {
    const isSupported = isNotificationSupported()
    setSupported(isSupported)
    
    if (isSupported) {
      const currentPermission = getNotificationPermission()
      setPermission(currentPermission)
      setSubscribed(currentPermission === 'granted')
    }
  }

  const handleEnableNotifications = async () => {
    setLoading(true)
    try {
      const granted = await requestNotificationPermission()
      
      if (granted) {
        await subscribeToNotifications()
        setPermission('granted')
        setSubscribed(true)
        
        // Show success notification
        await showNotification('Notifications Enabled', {
          body: '🎉 You will now receive important updates about your bookings!',
          tag: 'notification-enabled'
        })
      } else {
        alert('Please allow notifications in your browser settings to receive updates.')
      }
    } catch (error) {
      console.error('Error enabling notifications:', error)
      alert('Failed to enable notifications. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDisableNotifications = async () => {
    setLoading(true)
    try {
      await unsubscribeFromNotifications()
      setSubscribed(false)
      alert('Notifications disabled successfully.')
    } catch (error) {
      console.error('Error disabling notifications:', error)
      alert('Failed to disable notifications. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleTestNotification = async () => {
    await showNotification('Test Notification', {
      body: 'This is a test notification from MSEC Academics',
      icon: '/images/android-chrome-192x192.png',
      badge: '/images/favicon-32x32.png',
      tag: 'test-notification'
    })
  }

  if (!supported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm sm:text-base font-semibold text-yellow-900 mb-1">
              Notifications Not Supported
            </h3>
            <p className="text-xs sm:text-sm text-yellow-700">
              Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Edge.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-full ${subscribed ? 'bg-green-100' : 'bg-blue-100'}`}>
          <svg className={`w-6 h-6 ${subscribed ? 'text-green-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        
        <div className="flex-1">
          <h3 className="text-base sm:text-lg font-bold text-[#111418] mb-2">
            Push Notifications
          </h3>
          
          {permission === 'denied' ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">
                ⚠️ Notifications are blocked. Please enable them in your browser settings.
              </p>
            </div>
          ) : subscribed ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Notifications are enabled! You'll receive updates about your bookings.
              </p>
            </div>
          ) : (
            <p className="text-sm sm:text-base text-[#60758a] mb-4">
              Stay updated with real-time notifications about booking approvals, changes, and important announcements.
            </p>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3">
            {!subscribed ? (
              <button
                onClick={handleEnableNotifications}
                disabled={loading || permission === 'denied'}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-theme-gold hover:bg-theme-gold-500 text-white text-sm sm:text-base font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enabling...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Enable Notifications
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={handleTestNotification}
                  className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-theme-gold hover:bg-theme-gold-500 text-white text-sm sm:text-base font-semibold rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Test Notification
                </button>
                <button
                  onClick={handleDisableNotifications}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm sm:text-base font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {loading ? 'Disabling...' : 'Disable'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationSettings
