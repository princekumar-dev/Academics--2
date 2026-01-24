import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import apiClient from '../utils/apiClient'

function BottomNav() {
  const location = useLocation()
  const [userRole, setUserRole] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    checkAuthStatus()
    
    const handleAuthChange = () => {
      checkAuthStatus()
    }
    
    window.addEventListener('authStateChanged', handleAuthChange)
    return () => window.removeEventListener('authStateChanged', handleAuthChange)
  }, [])

  useEffect(() => {
    if (isLoggedIn) {
      // Disabled: Notifications API not implemented yet
      // fetchNotificationCount()
      // const interval = setInterval(fetchNotificationCount, 30000) // Check every 30s
      // return () => clearInterval(interval)
    }
  }, [isLoggedIn])

  const checkAuthStatus = () => {
    const auth = localStorage.getItem('auth')
    if (auth) {
      try {
        const authData = JSON.parse(auth)
        setIsLoggedIn(authData.isAuthenticated || false)
        setUserRole(authData.role || '')
      } catch (error) {
        setIsLoggedIn(false)
        setUserRole('')
      }
    }
  }

  const fetchNotificationCount = async () => {
    try {
      const auth = localStorage.getItem('auth')
      if (!auth) return
      
      const authData = JSON.parse(auth)
      const userId = authData._id || authData.id
      if (!userId) return
      
      const data = await apiClient.get(`/api/notifications?userId=${userId}&unreadOnly=true`)
      if (data?.success) {
        setUnreadNotifications(data.notifications?.length || 0)
      }
    } catch (error) {
      // Silently handle errors - notifications are optional
      console.debug('Could not fetch notifications:', error.message)
    }
  }

  const getNavItems = () => {
    const baseItems = [
      {
        name: 'Home',
        path: '/home',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        )
      }
    ]

    if (userRole === 'staff') {
      return [
        ...baseItems,
        {
          name: 'Marksheets',
          path: '/marksheets',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )
        },
        {
          name: 'Requests',
          path: '/dispatch-requests',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )
        },
        {
          name: 'Records',
          path: '/records',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          )
        }
      ]
    } else if (userRole === 'hod') {
      return [
        ...baseItems,
        {
          name: 'Overview',
          path: '/department-overview',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          )
        },
        {
          name: 'Approvals',
          path: '/approval-requests',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        },
        {
          name: 'Reports',
          path: '/reports',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )
        }
      ]
    } else if (userRole === 'student') {
      return [
        {
          name: 'My Marksheets',
          path: '/student',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )
        },
        {
          name: 'Leave/Late',
          path: '/leave',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )
        }
      ]
    }

    return baseItems
  }

  const isActive = (path) => {
    if (path === '/home') {
      return location.pathname === '/' || location.pathname === '/home'
    }
    return location.pathname.startsWith(path)
  }

  if (!isLoggedIn) return null

  const navItems = getNavItems()

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg safe-area-inset-bottom"
      style={{
        transform: 'translateZ(0)', /* Force GPU acceleration */
        willChange: 'transform'
      }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px] ${
              isActive(item.path)
                ? 'text-theme-gold bg-theme-gold-50'
                : 'text-gray-600 hover:text-theme-gold-500 hover:bg-gray-50'
            }`}
          >
            <div className="relative">
              {item.icon}
              {item.name === 'Profile' && unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </div>
            <span className={`text-xs mt-1 font-medium ${
              isActive(item.path) ? 'font-bold' : ''
            }`}>
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  )
}

export default BottomNav
