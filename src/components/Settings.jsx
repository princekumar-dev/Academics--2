import { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAlert } from './AlertContext'
import apiClient from '../utils/apiClient'
import {
  requestNotificationPermission,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  showNotification,
  isNotificationSupported,
  getNotificationPermission,
  checkCurrentSubscription
} from '../utils/notifications'

function Settings({ isOpen, onClose, userEmail, userRole, isMobile = false }) {
  const navigate = useNavigate()
  const { showSuccess, showError, showWarning, showInfo } = useAlert()
  const settingsRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const isMountedRef = useRef(true)

  // State management
  const [isFullWidthMobile, setIsFullWidthMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 768px)').matches
  })

  const mobileMode = isMobile || isFullWidthMobile

  // Notification states
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [notificationSupported] = useState(() => isNotificationSupported())
  const [notificationPermission, setNotificationPermission] = useState(() => {
    // Initialize with actual browser permission on mount
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'default'
  })
  const [notificationLoading, setNotificationLoading] = useState(false)

  // Signature states
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [signatureMode, setSignatureMode] = useState('draw')
  const [uploadedSignature, setUploadedSignature] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Password reset states
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [isInitializing, setIsInitializing] = useState(false)
  const [headerOffset, setHeaderOffset] = useState(0)
  const notificationsEnabledRef = useRef(notificationsEnabled)
  const toggleInProgressRef = useRef(false)

  // Initialize on mount
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  // Lock/unlock background scroll
  useEffect(() => {
    if (!(isMobile || isFullWidthMobile)) return

    // Only toggle overflow to prevent background scroll on mobile modals
    if (isOpen) {
      const prevOverflow = document.body.style.overflow || ''
      document.body.style.overflow = 'hidden'

      return () => {
        // Always restore to empty string (browser default) to ensure scrolling works
        document.body.style.overflow = prevOverflow || ''
      }
    }
  }, [isOpen, isMobile, isFullWidthMobile])

  // Load settings on modal open
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setIsInitializing(true)

    const load = async () => {
      try {
        // Get actual browser permission status
        let currentPermission = 'default'
        if (notificationSupported) {
          // Directly check Notification.permission for accuracy
          if ('Notification' in window) {
            currentPermission = Notification.permission
          } else {
            currentPermission = getNotificationPermission()
          }
        }

        console.log('Current notification permission:', currentPermission)
        if (!cancelled) setNotificationPermission(currentPermission)

        // Load user's preference from localStorage (source of truth)
        const savedSettings = localStorage.getItem('userSettings')
        let userPreference = false // Default OFF for new users

        if (savedSettings) {
          const settings = JSON.parse(savedSettings)
          userPreference = settings.notificationsEnabled === true
          console.log('Loaded user preference:', userPreference)

          if (!cancelled) {
            setEmailNotifications(settings.emailNotifications !== false)
            setNotificationsEnabled(userPreference)
          }
        } else {
          // New user - default OFF
          console.log('New user - defaulting notifications to OFF')
          if (!cancelled) {
            setNotificationsEnabled(false)
            localStorage.setItem('userSettings', JSON.stringify({
              notificationsEnabled: false,
              emailNotifications: true
            }))
          }
        }

        // Sync actual subscription with user preference in background
        try {
          const subResult = await checkCurrentSubscription()
          const subscriptionExists = subResult?.found === true
          console.log('Current subscription status:', subscriptionExists, '| User wants:', userPreference)

          // If preference and subscription are out of sync, fix it
          if (userPreference && !subscriptionExists && currentPermission === 'granted') {
            console.log('Creating missing subscription...')
            await subscribeToNotifications()
          } else if (!userPreference && subscriptionExists) {
            console.log('Removing unwanted subscription...')
            await unsubscribeFromNotifications()
          }
        } catch (err) {
          console.error('Error syncing subscription:', err)
        }
      } catch (err) {
        console.error('Error loading settings:', err)
      } finally {
        if (!cancelled) setIsInitializing(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [isOpen, notificationSupported])

  // Desktop: Close on outside click
  useEffect(() => {
    if (mobileMode) return

    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        if (!isInitializing) onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, mobileMode, isInitializing])

  // Desktop: Close on Escape
  useEffect(() => {
    if (mobileMode) return

    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, mobileMode])

  // Notification toggle - optimistic UI update
  const handleNotificationToggle = async () => {
    // Prevent multiple simultaneous toggles
    if (toggleInProgressRef.current) {
      console.log('Toggle already in progress, ignoring...')
      return
    }

    // Don't allow toggle during initialization
    if (notificationLoading || !notificationSupported || isInitializing) {
      console.log('Toggle blocked: loading=', notificationLoading, 'supported=', notificationSupported, 'initializing=', isInitializing)
      return
    }

    const newState = !notificationsEnabled
    console.log('Toggle clicked - changing from', notificationsEnabled, 'to', newState)

    // Immediately update UI (optimistic update)
    setNotificationsEnabled(newState)
    saveSettings('notificationsEnabled', newState)

    toggleInProgressRef.current = true
    setNotificationLoading(true)

    try {
      if (newState) {
        // User wants notifications ON
        console.log('Enabling notifications...')

        // Check if permission is already granted
        const currentPerm = 'Notification' in window ? Notification.permission : 'default'
        console.log('Current browser permission:', currentPerm)

        if (currentPerm === 'granted') {
          // Permission already granted, just subscribe
          console.log('Permission already granted, subscribing...')
          setNotificationPermission('granted')
          const subscription = await subscribeToNotifications()
          if (subscription) {
            console.log('Subscription successful:', subscription)
            showSuccess('Notifications Enabled', 'Push notifications activated!')
          } else {
            // Subscription failed, revert toggle
            console.error('Subscription returned null')
            setNotificationsEnabled(false)
            saveSettings('notificationsEnabled', false)
            showError('Subscription Failed', 'Unable to subscribe to notifications. Try again.')
          }
        } else if (currentPerm === 'denied') {
          // Permission explicitly denied
          console.log('Permission denied by browser')
          setNotificationsEnabled(false)
          saveSettings('notificationsEnabled', false)
          setNotificationPermission('denied')
          showError('Permission Blocked', 'Please enable notifications in your browser settings')
        } else {
          // Need to request permission
          console.log('Requesting permission...')
          const permissionGranted = await requestNotificationPermission()

          if (permissionGranted) {
            setNotificationPermission('granted')
            const subscription = await subscribeToNotifications()
            if (subscription) {
              console.log('Subscription successful:', subscription)
              showSuccess('Notifications Enabled', 'Push notifications activated!')
            } else {
              // Subscription failed, revert toggle
              console.error('Subscription returned null')
              setNotificationsEnabled(false)
              saveSettings('notificationsEnabled', false)
              showError('Subscription Failed', 'Unable to subscribe to notifications. Try again.')
            }
          } else {
            // Permission denied, revert toggle
            console.log('Permission request denied')
            setNotificationsEnabled(false)
            saveSettings('notificationsEnabled', false)
            setNotificationPermission('denied')
            showError('Permission Blocked', 'Please enable notifications in your browser settings')
          }
        }
      } else {
        // User wants notifications OFF
        console.log('Disabling notifications...')
        const success = await unsubscribeFromNotifications()
        console.log('Unsubscribe result:', success)

        // Always show success when turning off - the goal is achieved
        showInfo('Notifications Disabled', 'Push notifications turned off')
      }
    } catch (err) {
      console.error('Notification toggle error:', err)
      // On error, revert to previous state
      setNotificationsEnabled(!newState)
      saveSettings('notificationsEnabled', !newState)
      showError('Error', 'Failed to update notification settings')
    } finally {
      setNotificationLoading(false)
      toggleInProgressRef.current = false
    }
  }

  // Email notifications toggle
  const handleEmailNotificationToggle = () => {
    const newValue = !emailNotifications
    setEmailNotifications(newValue)
    saveSettings('emailNotifications', newValue)
  }

  // Save settings to localStorage
  const saveSettings = (key, value) => {
    const settings = JSON.parse(localStorage.getItem('userSettings') || '{}')
    settings[key] = value
    localStorage.setItem('userSettings', JSON.stringify(settings))
  }

  // Password reset
  const handlePasswordReset = async () => {
    setPasswordError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    setPasswordLoading(true)
    try {
      const userId = localStorage.getItem('userId')
      if (!userId) {
        setPasswordError('Session expired. Please log out and log in again.')
        return
      }

      const data = await apiClient.patch(`/api/users?action=reset-password&userId=${userId}`, { currentPassword, newPassword })
      if (!data || !data.success) {
        setPasswordError(data?.error || 'Failed to reset password')
        return
      }

      showSuccess('Success', 'Password changed successfully!')
      closePasswordModal()
    } catch (err) {
      console.error('Password reset error:', err)
      setPasswordError('Error: ' + err.message)
    } finally {
      setPasswordLoading(false)
    }
  }

  // Close password modal
  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
  }

  // Signature handlers
  const getCanvasCoordinates = (e, rect) => {
    // Handle both mouse and touch events
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const handleCanvasMouseDown = (e) => {
    e.preventDefault()
    setIsDrawing(true)
    const rect = canvasRef.current.getBoundingClientRect()
    const ctx = canvasRef.current.getContext('2d')
    const coords = getCanvasCoordinates(e, rect)
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const ctx = canvasRef.current.getContext('2d')
    const coords = getCanvasCoordinates(e, rect)
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
  }

  const handleCanvasMouseUp = (e) => {
    if (e) e.preventDefault()
    setIsDrawing(false)
  }

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      showError('File too large', 'Maximum 2MB allowed')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        // Create canvas for processing
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')

        // Draw white background
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw the image
        ctx.drawImage(img, 0, 0)

        // Get image data to find signature bounds
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // Find bounding box of non-white pixels (signature)
        let minX = canvas.width
        let minY = canvas.height
        let maxX = 0
        let maxY = 0

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]

          // Check if pixel is not white and not transparent
          if ((r < 250 || g < 250 || b < 250) && a > 128) {
            const pixelIndex = i / 4
            const x = pixelIndex % canvas.width
            const y = Math.floor(pixelIndex / canvas.width)

            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }

        // Add padding around signature
        const padding = 10
        minX = Math.max(0, minX - padding)
        minY = Math.max(0, minY - padding)
        maxX = Math.min(canvas.width, maxX + padding)
        maxY = Math.min(canvas.height, maxY + padding)

        // If signature found, crop it
        if (minX < maxX && minY < maxY) {
          const croppedCanvas = document.createElement('canvas')
          croppedCanvas.width = maxX - minX
          croppedCanvas.height = maxY - minY

          const croppedCtx = croppedCanvas.getContext('2d')
          croppedCtx.fillStyle = '#FFFFFF'
          croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height)
          croppedCtx.drawImage(canvas, minX, minY, maxX - minX, maxY - minY, 0, 0, croppedCanvas.width, croppedCanvas.height)

          setUploadedSignature(croppedCanvas.toDataURL('image/png'))
        } else {
          // No signature found, use original with white background
          setUploadedSignature(canvas.toDataURL('image/png'))
        }
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const clearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
    setUploadedSignature(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const saveSignature = async () => {
    const signatureData = signatureMode === 'draw'
      ? canvasRef.current?.toDataURL('image/png')
      : uploadedSignature

    if (!signatureData) {
      showError('No signature', 'Please draw or upload a signature')
      return
    }

    try {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}')
      const userId = auth?.id || localStorage.getItem('userId')

      // Save signature at top level (same structure as login)
      auth.eSignature = signatureData
      localStorage.setItem('auth', JSON.stringify(auth))

      // Persist to backend if userId is available
      if (userId) {
        try {
          const resp = await apiClient.patch(`/api/users?action=update-signature&userId=${userId}`, { eSignature: signatureData })
          if (!resp || !resp.success) {
            console.warn('Could not persist signature to backend:', resp?.error)
          }
        } catch (err) {
          console.warn('Backend signature save failed:', err && err.message ? err.message : err)
        }
      }

      // Notify other parts of the app that auth changed (so they can reload user info)
      try { window.dispatchEvent(new Event('authStateChanged')) } catch (e) { }

      showSuccess('Saved', 'Signature saved successfully!')
      setShowSignatureModal(false)
      setSignatureMode('draw')
      setUploadedSignature(null)
    } catch (err) {
      console.error('Signature save error:', err)
      showError('Error', 'Failed to save signature')
    }
  }

  const closeSignatureModal = () => {
    setShowSignatureModal(false)
    setSignatureMode('draw')
    setUploadedSignature(null)
    clearSignature()
  }

  // Logout
  const handleLogout = () => {
    try {
      onClose()
    } catch (err) {
      console.error('Error closing modal:', err)
    }

    localStorage.removeItem('auth')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userId')

    window.dispatchEvent(new Event('authStateChanged'))

    try {
      navigate('/login')
    } catch (err) {
      window.location.href = '/login'
    }
  }

  const handleEmailSupport = (e) => {
    e.stopPropagation()
    e.preventDefault()
    window.location.href = "mailto:support@msecacademics.edu?subject=MSEC Academics Support"
    setTimeout(() => { onClose() }, 300)
  }

  if (!isOpen) return null

  // ============ RENDER ============

  const SettingsContent = () => {
    // Get student name from localStorage for display
    const displayName = (() => {
      if (userRole === 'student') {
        try {
          const auth = JSON.parse(localStorage.getItem('auth') || '{}')
          return auth?.name || userEmail
        } catch {
          return userEmail
        }
      }
      return userEmail
    })()

    const displayInitial = (() => {
      if (userRole === 'student') {
        try {
          const auth = JSON.parse(localStorage.getItem('auth') || '{}')
          return auth?.name?.charAt(0).toUpperCase() || 'S'
        } catch {
          return 'S'
        }
      }
      return userEmail?.charAt(0).toUpperCase() || '?'
    })()

    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (!isInitializing) onClose()
          }}
          className={`absolute z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 active:bg-gray-300 transition-colors touch-manipulation ${isFullWidthMobile ? 'top-3 right-3 sm:top-4 sm:right-4' : 'top-3 right-3'}`}
          aria-label="Close settings"
          style={{ touchAction: 'manipulation', boxSizing: 'border-box' }}
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="px-4 sm:px-4 py-3 sm:py-4 border-b border-[#e7edf4] hover:bg-gray-50/50 transition-colors duration-200">
          <div className="flex items-center gap-3 pr-6">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
              <span className="text-base font-bold text-yellow-600 group-hover:text-yellow-700 transition-colors duration-200">
                {displayInitial}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[#0b1220] font-semibold text-sm truncate group-hover:text-black transition-colors duration-200">{displayName}</h3>
              <p className="text-[#475569] text-xs capitalize group-hover:text-[#374151] transition-colors duration-200">{userRole} Account</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  const SettingsBody = () => (
    <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-5 flex-1 overflow-y-auto overflow-x-hidden smooth-scroll settings-content" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent', scrollBehavior: 'smooth', width: '100%', boxSizing: 'border-box' }}>
      {/* Account Section - Hide signature for students */}
      {userRole !== 'student' && (
        <div>
          <h4 className="text-sm font-semibold text-[#111418] group-hover:text-[#0b1220] mb-2 flex items-center gap-2 transition-colors duration-200">
            <svg className="w-4 h-4 group-hover:text-yellow-600 transition-colors duration-200" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            Account
          </h4>
          <div className="space-y-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowSignatureModal(true)
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/6 hover:bg-white/12 hover:shadow-sm active:bg-white/5 transition-all duration-200 text-left min-h-[52px] cursor-pointer group"
              style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
            >
              <svg className="w-4 h-4 text-[#60758a] group-hover:text-[#4a5568] flex-shrink-0 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#111418] group-hover:text-[#0b1220] transition-colors duration-200">Add Signature</p>
                <p className="text-xs text-[#60758a] group-hover:text-[#4a5568] mt-0.5 transition-colors duration-200">Draw your digital signature for PDFs</p>
              </div>
              <svg className="w-4 h-4 text-[#60758a] group-hover:text-[#4a5568] group-hover:translate-x-1 flex-shrink-0 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowPasswordModal(true)
                setPasswordError('')
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/6 hover:bg-white/12 hover:shadow-sm active:bg-white/5 transition-all duration-200 text-left min-h-[52px] cursor-pointer group"
              style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
            >
              <svg className="w-4 h-4 text-[#60758a] group-hover:text-[#4a5568] flex-shrink-0 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#111418] group-hover:text-[#0b1220] transition-colors duration-200">Reset Password</p>
                <p className="text-xs text-[#60758a] group-hover:text-[#4a5568] mt-0.5 transition-colors duration-200">Change your account password</p>
              </div>
              <svg className="w-4 h-4 text-[#60758a] group-hover:text-[#4a5568] group-hover:translate-x-1 flex-shrink-0 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Student-only info section */}
      {userRole === 'student' && (
        <div>
          <h4 className="text-sm font-semibold text-[#111418] group-hover:text-[#0b1220] mb-2 flex items-center gap-2 transition-colors duration-200">
            <svg className="w-4 h-4 group-hover:text-yellow-600 transition-colors duration-200" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            Account
          </h4>
          <div className="space-y-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowPasswordModal(true)
                setPasswordError('')
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/6 hover:bg-white/12 hover:shadow-sm active:bg-white/5 transition-all duration-200 text-left min-h-[52px] cursor-pointer group"
              style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
            >
              <svg className="w-4 h-4 text-[#60758a] group-hover:text-[#4a5568] flex-shrink-0 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#111418] group-hover:text-[#0b1220] transition-colors duration-200">Change Password</p>
                <p className="text-xs text-[#60758a] group-hover:text-[#4a5568] mt-0.5 transition-colors duration-200">Update your login password</p>
              </div>
              <svg className="w-4 h-4 text-[#60758a] group-hover:text-[#4a5568] group-hover:translate-x-1 flex-shrink-0 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Notifications Section */}
      <div className="border-t border-[#e7edf4] pt-3">
        <h4 className="text-sm font-semibold text-[#111418] group-hover:text-[#0b1220] mb-2 flex items-center gap-2 transition-colors duration-200">
          <svg className="w-4 h-4 group-hover:text-yellow-600 transition-colors duration-200" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          Notifications
        </h4>

        {!notificationSupported && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
            <p className="text-xs text-yellow-700">Browser notifications not supported</p>
          </div>
        )}

        {notificationPermission === 'denied' && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
            <p className="text-xs text-red-700">Notifications blocked. Enable in browser settings.</p>
          </div>
        )}

        {notificationsEnabled && notificationPermission === 'granted' && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-3">
            <p className="text-xs text-green-700">✓ Notifications enabled successfully!</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/6 min-h-[52px]">
            <div className="flex-1">
              <p className="text-sm font-medium text-[#111418]">Push Notifications</p>
              <p className="text-xs text-[#60758a]">Get academic notifications</p>
            </div>
            <div className="flex-shrink-0 toggle-touch-area">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('Button clicked by user')
                  handleNotificationToggle()
                }}
                disabled={notificationLoading || !notificationSupported || notificationPermission === 'denied' || isInitializing}
                className={`toggle-switch ${notificationsEnabled ? 'enabled' : 'disabled'} ${notificationLoading || isInitializing ? 'toggle-loading' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
                aria-label={`${notificationsEnabled ? 'Disable' : 'Enable'} push notifications`}
              >
                {notificationLoading ? (
                  <div className="toggle-knob">
                    <svg className="animate-spin h-3 w-3 text-theme-gold-600 mx-auto" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                ) : (
                  <div className={`toggle-knob ${notificationsEnabled ? 'enabled' : 'disabled'}`} />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-white/6 min-h-[52px]">
            <div className="flex-1">
              <p className="text-sm font-medium text-[#111418]">Email Notifications</p>
              <p className="text-xs text-[#60758a]">Receive academic updates via email</p>
            </div>
            <div className="flex-shrink-0 toggle-touch-area">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleEmailNotificationToggle()
                }}
                className={`toggle-switch ${emailNotifications ? 'enabled' : 'disabled'}`}
                style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
                aria-label={`${emailNotifications ? 'Disable' : 'Enable'} email notifications`}
              >
                <div className={`toggle-knob ${emailNotifications ? 'enabled' : 'disabled'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="border-t border-[#e7edf4] pt-3">
        <h4 className="text-sm font-semibold text-[#111418] group-hover:text-[#0b1220] mb-2 flex items-center gap-2 transition-colors duration-200">
          <svg className="w-4 h-4 group-hover:text-yellow-600 transition-colors duration-200" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          Help & Support
        </h4>
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleEmailSupport}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/6 hover:bg-white/12 hover:shadow-sm active:bg-white/5 transition-all duration-200 text-left min-h-[52px] cursor-pointer group"
            style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
          >
            <svg className="w-4 h-4 text-[#60758a] group-hover:text-[#4a5568] flex-shrink-0 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-[#111418] group-hover:text-[#0b1220] flex-1 transition-colors duration-200">Email Support</span>
            <svg className="w-4 h-4 text-[#60758a] group-hover:text-[#4a5568] group-hover:translate-x-1 group-hover:-translate-y-1 flex-shrink-0 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="border-t border-[#e7edf4] pt-3 mt-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleLogout()
          }}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 font-semibold text-sm transition-colors min-h-[48px] cursor-pointer"
          style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  )

  // ============ MAIN RENDER ============

  const mainModalContent = (
    <div
      ref={settingsRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={(
        isFullWidthMobile
          ? 'inner-panel pointer-events-auto'
          : 'settings-glass-card no-mobile-backdrop pointer-events-auto'
      ) + ' rounded-xl shadow-lg overflow-hidden w-full max-w-sm mx-auto flex flex-col group ' + (
          isFullWidthMobile
            ? 'rounded-b-2xl sm:rounded-xl max-w-md'
            : 'absolute top-full right-0 mt-2 w-80'
        )}
      style={{
        boxShadow: '0 8px 28px rgba(2,6,23,0.06)',
        background: isFullWidthMobile ? '#ffffff' : undefined,
        maxHeight: isFullWidthMobile ? 'calc(100vh - 80px)' : '90vh',
        overflowY: 'auto',
        ...(isFullWidthMobile && {
          marginTop: '100px',
          marginLeft: 'auto',
          marginRight: 'auto'
        })
      }}
      onMouseEnter={() => {
        if (!mobileMode && typeof document !== 'undefined') {
          document.body.classList.add('settings-hover-active')
        }
      }}
      onMouseLeave={() => {
        if (!mobileMode && typeof document !== 'undefined') {
          document.body.classList.remove('settings-hover-active')
        }
      }}
    >
      <SettingsContent />
      <SettingsBody />

      {/* Sub-modals rendered as centered overlays on top of Settings */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.currentTarget === e.target) {
              closePasswordModal()
            }
          }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Reset Password</h2>

            {passwordError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{passwordError}</p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-500 focus:outline-none text-base"
                  autoComplete="current-password"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-500 focus:outline-none text-base"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-500 focus:outline-none text-base"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closePasswordModal}
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={passwordLoading}
                className="flex-1 px-4 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-60 font-semibold text-sm transition-colors"
              >
                {passwordLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignatureModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.currentTarget === e.target) {
              closeSignatureModal()
            }
          }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Your Signature</h2>
            <p className="text-sm text-gray-600 mb-5">This signature will be used in generated PDFs</p>

            <div className="flex gap-2 mb-5 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setSignatureMode('draw')}
                className={`flex-1 py-2.5 px-4 rounded-md font-semibold text-sm transition-all ${signatureMode === 'draw'
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                ✍️ Draw
              </button>
              <button
                onClick={() => setSignatureMode('upload')}
                className={`flex-1 py-2.5 px-4 rounded-md font-semibold text-sm transition-all ${signatureMode === 'upload'
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                📤 Upload
              </button>
            </div>

            {signatureMode === 'draw' && (
              <div className="mb-5 border-2 border-gray-300 rounded-xl overflow-hidden bg-white" style={{ height: '160px' }}>
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={160}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  onTouchStart={handleCanvasMouseDown}
                  onTouchMove={handleCanvasMouseMove}
                  onTouchEnd={handleCanvasMouseUp}
                  className="w-full h-full cursor-crosshair"
                  style={{ touchAction: 'none', display: 'block' }}
                />
              </div>
            )}

            {signatureMode === 'upload' && (
              <div className="mb-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleSignatureUpload}
                  className="hidden"
                  id="signature-upload"
                />
                {uploadedSignature ? (
                  <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white flex items-center justify-center" style={{ height: '160px' }}>
                    <img src={uploadedSignature} alt="Uploaded" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <label
                    htmlFor="signature-upload"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-yellow-500 hover:bg-yellow-50 transition-all"
                    style={{ height: '160px' }}
                  >
                    <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Click to upload signature</p>
                    <p className="text-xs text-gray-500">JPEG or PNG (max 2MB)</p>
                  </label>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={clearSignature}
                className="flex-1 px-4 py-2.5 border-2 border-gray-400 text-gray-700 rounded-lg hover:bg-gray-100 font-semibold text-sm transition-colors"
              >
                Clear
              </button>
              <button
                onClick={closeSignatureModal}
                className="flex-1 px-4 py-2.5 border-2 border-gray-400 text-gray-700 rounded-lg hover:bg-gray-100 font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSignature}
                className="flex-1 px-4 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-semibold text-sm transition-colors shadow-md"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Desktop: Render as dropdown
  if (!mobileMode) {
    return mainModalContent
  }

  // Mobile: Render as fullscreen modal with backdrop
  const mobileModalContent = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.currentTarget === e.target) {
          onClose()
        }
      }}
    >
      <div className="w-full flex-1 overflow-y-auto">
        {mainModalContent}
      </div>
    </div>
  )

  if (isFullWidthMobile) {
    return ReactDOM.createPortal(mobileModalContent, document.body)
  }

  return mainModalContent
}

export default Settings
