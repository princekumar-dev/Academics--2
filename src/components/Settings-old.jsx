import { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAlert } from './AlertContext'
import { 
  requestNotificationPermission, 
  subscribeToNotifications,
  unsubscribeFromNotifications,
  showNotification,
  isNotificationSupported,
  getNotificationPermission
  , checkCurrentSubscription
} from '../utils/notifications'

function Settings({ isOpen, onClose, userEmail, userRole, isMobile = false }) {
  const navigate = useNavigate()
  const { showSuccess, showError, showWarning } = useAlert()
  const settingsRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const [signatureMode, setSignatureMode] = useState('draw') // 'draw' or 'upload'
  const [uploadedSignature, setUploadedSignature] = useState(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [notificationSupported, setNotificationSupported] = useState(() => isNotificationSupported())
  const [notificationPermission, setNotificationPermission] = useState('default')
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [signatureStatus, setSignatureStatus] = useState('') // 'saved', 'cleared', etc.
  // Detect actual viewport size so we can decide whether to show
  // the centered mobile modal or the desktop right-side panel.
  const [isFullWidthMobile, setIsFullWidthMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 768px)').matches
  })

  // Derive the effective "mobile mode" based on prop OR viewport.
  // This keeps backwards compatibility when parent explicitly sets isMobile,
  // but prefers the actual viewport size for layout decisions.
  const mobileMode = isMobile || isFullWidthMobile
  const [headerOffset, setHeaderOffset] = useState(0)
  // Track mounted state so async callbacks don't call setState after unmount
  const isMountedRef = useRef(true)

  // Close dropdown when clicking outside (only for desktop)
  useEffect(() => {
    if (isMobile) return // Don't attach click-outside listener for mobile
    
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        if (!isInitializing) onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, isMobile])

  // Close on Escape key (only for desktop)
  useEffect(() => {
    if (isMobile) return // Don't attach escape key listener for mobile
    
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, isMobile])

  // Lock background scroll when modal is open on mobile full-width
  useEffect(() => {
    isMountedRef.current = true
    if (!(isMobile || isFullWidthMobile)) return;

    // Only toggle overflow to prevent background scroll on mobile.
    // Avoid changing `position` or `width` to prevent viewport locking bugs
    // in some Chromium/Edge versions.
    let prevOverflow;
    if (isOpen && (isMobile || isFullWidthMobile)) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const restoreScroll = () => {
        document.body.style.overflow = prevOverflow;
      };
      window.addEventListener('settingsModalClose', restoreScroll);
      return () => {
        restoreScroll();
        window.removeEventListener('settingsModalClose', restoreScroll);
      };
    }
    // If modal is not open, ensure overflow is not forced.
    if (!isOpen) {
      document.body.style.overflow = '';
    }
    return undefined;
  }, [isOpen, isMobile, isFullWidthMobile]);

  useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  // Always load settings from localStorage when modal is opened
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false
    setIsInitializing(true)

    const load = async () => {
      try {
        // Check notification support
        const isSupported = isNotificationSupported();
        if (!cancelled) setNotificationSupported(isSupported);

        const currentPermission = isSupported ? getNotificationPermission() : 'default';
        if (!cancelled) setNotificationPermission(currentPermission);

        const savedSettings = localStorage.getItem('userSettings');
        if (savedSettings) {
          try {
            const settings = JSON.parse(savedSettings);
            if (!cancelled) setEmailNotifications(settings.emailNotifications !== false);
            if (!cancelled) {
              if (typeof settings.notificationsEnabled === 'boolean') {
                setNotificationsEnabled(settings.notificationsEnabled);
              } else {
                setNotificationsEnabled(false);
              }
            }

            // Also verify actual browser subscription state and prefer that if present
            try {
              const subResult = await checkCurrentSubscription()
              if (subResult && subResult.found) {
                // If subscription exists in browser, reflect it in UI and persist
                if (isMountedRef.current && !cancelled) setNotificationsEnabled(true)
                saveSettings('notificationsEnabled', true)
              }
            } catch (err) {
              // Ignore errors checking subscription
              console.error('Error checking current subscription on open:', err)
            }

          } catch (error) {
            console.error('Error loading settings:', error);
            if (!cancelled) setNotificationsEnabled(false);
          }
        } else {
          if (!cancelled) setNotificationsEnabled(false);
        }
      } finally {
        if (!cancelled && isMountedRef.current) setIsInitializing(false)
      }
    }

    load()

    return () => { cancelled = true }
  }, [isOpen]);

  // Detect small mobile widths and compute header offset so we can position
  // the settings panel full-width below the header on small devices.
  useEffect(() => {
    // Always listen to resize/orientation so we can update the mobile
    // layout when the viewport crosses the breakpoint.
    if (typeof window === 'undefined') return undefined

    const update = () => {
      const isSmall = window.matchMedia('(max-width: 768px)').matches
      setIsFullWidthMobile(isSmall)

      const headerEl = document.querySelector('header')
      const h = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) : 0
      setHeaderOffset(h)
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  // Removed auto-enable notifications logic for all devices

  // Save settings to localStorage
  const saveSettings = (key, value) => {
    const currentSettings = JSON.parse(localStorage.getItem('userSettings') || '{}')
    const newSettings = { ...currentSettings, [key]: value }
    localStorage.setItem('userSettings', JSON.stringify(newSettings))
  }

  // Signature drawing functions (stable via useCallback)
  const startDrawing = useCallback((e) => {
    if (!canvasRef.current) return
    if (e.type === 'mousedown') {
      e.preventDefault()
    }
    e.stopPropagation()
    setIsDrawing(true)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : (e.clientX ?? e.pageX)
    const clientY = e.touches ? e.touches[0].clientY : (e.clientY ?? e.pageY)
    const x = clientX - rect.left
    const y = clientY - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [canvasRef])

  const draw = useCallback((e) => {
    if (!isDrawing || !canvasRef.current) return
    if (e.type === 'mousemove') {
      e.preventDefault()
    }
    e.stopPropagation()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : (e.clientX ?? e.pageX)
    const clientY = e.touches ? e.touches[0].clientY : (e.clientY ?? e.pageY)
    const x = clientX - rect.left
    const y = clientY - rect.top
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#000'
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [isDrawing, canvasRef])

  const stopDrawing = useCallback((e) => {
    if (e) {
      e.stopPropagation()
    }
    setIsDrawing(false)
  }, [])

  // Pointer-based handlers (more reliable on mobile)
  const pointerStart = useCallback((e) => {
    if (!canvasRef.current) return
    try { e.preventDefault() } catch (err) {}
    const canvas = canvasRef.current
    canvas.setPointerCapture?.(e.pointerId)
    startDrawing(e)
  }, [canvasRef, startDrawing])

  const pointerMove = useCallback((e) => {
    // Only draw when pointer is active
    if (!isDrawing) return
    draw(e)
  }, [isDrawing, draw])

  const pointerEnd = useCallback((e) => {
    try { e.preventDefault() } catch (err) {}
    const canvas = canvasRef.current
    canvas?.releasePointerCapture?.(e.pointerId)
    stopDrawing()
  }, [canvasRef, stopDrawing])

  const clearSignature = () => {
    if (signatureMode === 'draw' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    } else if (signatureMode === 'upload') {
      setUploadedSignature(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Initialize canvas for devicePixelRatio and attach pointer/touch handlers
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Ensure we only initialize once to avoid wiping user drawing
    const initRef = canvas.__initialized || { value: false }
    if (initRef.value) return

    const ctx = canvas.getContext('2d')
    const ratio = window.devicePixelRatio || 1
    const w = 400
    const h = 160

    // Set actual pixel size while keeping CSS size stable
    canvas.width = Math.round(w * ratio)
    canvas.height = Math.round(h * ratio)
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    ctx.scale(ratio, ratio)

    // Fill background white (so exported PNG has white background)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)

    // Attach pointer events for more reliable touch drawing
    canvas.addEventListener('pointerdown', pointerStart)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerEnd)
    canvas.addEventListener('pointercancel', pointerEnd)

    // Prevent default touch scrolling while interacting with canvas
    const passiveHandler = (e) => { try { e.preventDefault() } catch (err) {} }
    canvas.addEventListener('touchstart', passiveHandler, { passive: false })
    canvas.addEventListener('touchmove', passiveHandler, { passive: false })

    // mark initialized to avoid reinit
    canvas.__initialized = initRef
    initRef.value = true

    return () => {
      canvas.removeEventListener('pointerdown', pointerStart)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerEnd)
      canvas.removeEventListener('pointercancel', pointerEnd)
      canvas.removeEventListener('touchstart', passiveHandler)
      canvas.removeEventListener('touchmove', passiveHandler)
    }
  }, [canvasRef, pointerStart, pointerMove, pointerEnd])

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
      showWarning('Invalid File Format', '📸 Please upload a signature image in JPEG or PNG format. Current file type is not supported.')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showWarning('File Too Large', 'Image size must be less than 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        // Create canvas to resize/optimize image
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        // Set max dimensions (maintain aspect ratio)
        const maxWidth = 400
        const maxHeight = 150
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)
        
        // Remove white background and make transparent
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data
        
        // Threshold for white background removal (adjust for off-white colors)
        const threshold = 240
        
        for (let i = 0; i < data.length; i += 4) {
          const red = data[i]
          const green = data[i + 1]
          const blue = data[i + 2]
          
          // If pixel is close to white, make it transparent
          if (red > threshold && green > threshold && blue > threshold) {
            data[i + 3] = 0 // Set alpha to 0 (transparent)
          }
          // If pixel is grayish/light (likely from signature), keep but enhance contrast
          else if (red > 200 && green > 200 && blue > 200) {
            // Darken light grays to make signature more visible
            data[i] = Math.max(0, red - 100)
            data[i + 1] = Math.max(0, green - 100)
            data[i + 2] = Math.max(0, blue - 100)
          }
        }
        
        ctx.putImageData(imageData, 0, 0)
        
        // Convert to base64 with transparency
        const signatureData = canvas.toDataURL('image/png')
        setUploadedSignature(signatureData)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const saveSignature = async () => {
    let signatureData = null

    if (signatureMode === 'draw') {
      if (!canvasRef.current) return
      signatureData = canvasRef.current.toDataURL('image/png')
    } else if (signatureMode === 'upload') {
      if (!uploadedSignature) {
        showWarning('Signature Required', 'Please upload a signature image')
        return
      }
      signatureData = uploadedSignature
    }

    if (!signatureData) return
    
    try {
      const userId = localStorage.getItem('userId')
      
      if (!userId) {
        showError('Session Expired', '🔐 Your session has expired. Please log out and log in again to continue.')
        return
      }

      try {
        const data = await apiClient.patch(`/api/users?action=update-signature&userId=${userId}`, { eSignature: signatureData })
        if (!data || !data.success) {
          showError('Save Failed', '❌ Unable to save signature: ' + (data?.error || 'Server error. Please try again or contact support if the issue persists.'))
          return
        }
      } catch (err) {
        console.error('Error saving signature via API:', err)
        showError('Upload Failed', '📤 Failed to save signature: ' + (err.message || 'Network error. Check your connection and try again.'))
        return
      }

      // Update localStorage auth object with the new signature
      const auth = localStorage.getItem('auth')
      if (auth) {
        try {
          const authData = JSON.parse(auth)
          authData.eSignature = signatureData
          localStorage.setItem('auth', JSON.stringify(authData))
        } catch (e) {
          console.error('Error updating auth in localStorage:', e)
        }
      }

      setSignatureStatus('saved')
      setTimeout(() => setSignatureStatus(''), 2000)
      setShowSignatureModal(false)
      showSuccess('Signature Saved', 'Your signature has been saved successfully!')
    } catch (error) {
      console.error('Error saving signature:', error)
      showError('Upload Failed', '📤 Failed to save signature: ' + (error.message || 'Network error. Check your connection and try again.'))
    }
  }

  // Password reset functions
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
        setPasswordError('🔐 Session expired. Please log out and log in again to reset your password.')
        return
      }

      const data = await apiClient.patch(`/api/users?action=reset-password&userId=${userId}`, { 
        currentPassword,
        newPassword
      })
      if (!data || !data.success) {
        setPasswordError(data?.error || 'Failed to reset password')
        return
      }

      showSuccess('Password Changed', 'Your password has been changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordModal(false)
    } catch (error) {
      console.error('Error resetting password:', error)
      setPasswordError('Error: ' + error.message)
    } finally {
      setPasswordLoading(false)
    }
  }

  // Save notification toggle state to localStorage when changed
  useEffect(() => {
    const currentSettings = JSON.parse(localStorage.getItem('userSettings') || '{}')
    currentSettings.notificationsEnabled = notificationsEnabled
    localStorage.setItem('userSettings', JSON.stringify(currentSettings))
  }, [notificationsEnabled])

  // Keep a ref with the latest notificationsEnabled so event handlers
  // can read the current value at modal close and persist it.
  const notificationsEnabledRef = useRef(notificationsEnabled)
  useEffect(() => { notificationsEnabledRef.current = notificationsEnabled }, [notificationsEnabled])

  // Persist the current notificationsEnabled when the modal closes via
  // the settingsModalClose event (dispatched when component unmounts/close)
  useEffect(() => {
    const saveOnClose = () => {
      try {
        saveSettings('notificationsEnabled', notificationsEnabledRef.current)
      } catch (err) {
        console.error('Error saving notificationsEnabled on close:', err)
      }
    }
    window.addEventListener('settingsModalClose', saveOnClose)
    return () => window.removeEventListener('settingsModalClose', saveOnClose)
  }, [])

  // Diagnostic function to check notification system status
  const checkNotificationSystem = async () => {
    console.log('=== NOTIFICATION SYSTEM STATUS ===')
    console.log('1. Browser Support:', isNotificationSupported())
    console.log('2. Notification Permission:', Notification.permission)
    console.log('3. Service Worker Support:', 'serviceWorker' in navigator)
    console.log('4. Push Manager Support:', 'PushManager' in window)
    console.log('5. User Email:', userEmail)
    console.log('6. User Role:', userRole)
    
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        console.log('7. Service Worker Status:', registration.active ? 'Active' : 'Inactive')
        
        const subscription = await registration.pushManager.getSubscription()
        console.log('8. Push Subscription:', subscription ? 'Subscribed' : 'Not Subscribed')
        if (subscription) {
          console.log('   - Endpoint:', subscription.endpoint.substring(0, 50) + '...')
        }
      } catch (error) {
        console.error('7-8. Service Worker/Subscription Error:', error)
      }
    }
    
    console.log('9. Notifications Enabled State:', notificationsEnabled)
    console.log('10. Email Notifications:', emailNotifications)
    console.log('==================================')
  }

  const handleNotificationToggle = async () => {
    // Run diagnostic check
    await checkNotificationSystem()

    if (!notificationsEnabled) {
      // Optimistic enable: set state and persist immediately so closing modal
      // doesn't make the UI appear to revert before the async work finishes.
      setNotificationsEnabled(true)
      saveSettings('notificationsEnabled', true)
      setNotificationLoading(true)
      try {
        console.log('🔔 Attempting to enable notifications...')
        const granted = await requestNotificationPermission()
        console.log('Permission result:', granted)

        if (granted) {
          console.log('📝 Subscribing to notifications...')
          const subscriptionResult = await subscribeToNotifications()
          console.log('Subscription result:', subscriptionResult)

          if (isMountedRef.current) {
            setNotificationPermission('granted')
          }

          // Show success notification (best-effort)
          try {
            await showNotification('Notifications Enabled', {
              body: '🎉 You will now receive important updates about your academics!',
              tag: 'notification-enabled-' + Date.now()
            })
          } catch (err) {
            // ignore failure to show notification
          }

          console.log('✅ Notifications enabled successfully')
        } else {
          console.warn('❌ Permission denied')
          // Revert optimistic change
          if (isMountedRef.current) setNotificationsEnabled(false)
          saveSettings('notificationsEnabled', false)
          showWarning('Permission Required', '🔔 Notifications are blocked. To enable:\n1. Click the lock icon in your address bar\n2. Set Notifications to "Allow"\n3. Refresh this page')
        }
      } catch (error) {
        console.error('❌ Error enabling notifications:', error)
        if (isMountedRef.current) setNotificationsEnabled(false)
        saveSettings('notificationsEnabled', false)
        showError('Notification Error', 'Failed to enable notifications: ' + error.message)
      } finally {
        if (isMountedRef.current) setNotificationLoading(false)
      }
    } else {
      // Optimistic disable: persist immediately so UI reflects user action
      setNotificationsEnabled(false)
      saveSettings('notificationsEnabled', false)
      setNotificationLoading(true)
      try {
        console.log('🔕 Attempting to disable notifications...')
        await unsubscribeFromNotifications()
        if (isMountedRef.current) setNotificationPermission('default')
        console.log('✅ Notifications disabled successfully')
      } catch (error) {
        console.error('❌ Error disabling notifications:', error)
        // If disabling failed, revert optimistic change
        if (isMountedRef.current) setNotificationsEnabled(true)
        saveSettings('notificationsEnabled', true)
        showError('Notification Error', 'Failed to disable notifications: ' + error.message)
      } finally {
        if (isMountedRef.current) setNotificationLoading(false)
      }
    }
  }

  const handleTestNotification = async () => {
    try {
      console.log('Test notification button clicked')
      console.log('Notification permission:', Notification.permission)
      console.log('Notifications enabled:', notificationsEnabled)
      
      if (Notification.permission !== 'granted') {
        showWarning('Enable Notifications', 'Please enable notifications first by toggling the Push Notifications switch above.')
        return
      }
      
      // Use unique tag with timestamp to ensure notification shows every time
      const timestamp = Date.now()
      const uniqueTag = `test-notification-${timestamp}`
      
      console.log('Attempting to show test notification with tag:', uniqueTag)
      
      // Use the showNotification utility function which handles service worker properly
      await showNotification('Test Notification 🔔', {
  body: `This is a test notification from MSEC Academics! Time: ${new Date().toLocaleTimeString()}`,
        icon: '/images/android-chrome-192x192.png',
        badge: '/images/favicon-32x32.png',
        tag: uniqueTag,
        requireInteraction: false,
        vibrate: [200, 100, 200],
        timestamp: timestamp,
        silent: false,
        data: {
          url: window.location.origin,
          timestamp: timestamp
        }
      })
      
      console.log('Test notification sent successfully using service worker')
      
    } catch (error) {
      console.error('Error sending test notification:', error)
      showError('Test Failed', 'Failed to send test notification: ' + error.message)
    }
  }

  const handleEmailNotificationToggle = () => {
    const newValue = !emailNotifications
    setEmailNotifications(newValue)
    saveSettings('emailNotifications', newValue)
  }

  const handleEmailSupport = (e) => {
    e.stopPropagation()
    e.preventDefault()
    
  const emailUrl = "mailto:support@msecacademics.edu?subject=MSEC Academics Support Request&body=Hello MSEC Academics Team,%0D%0A%0D%0APlease describe your issue or question here:%0D%0A%0D%0A"
    
    // Open email client
    window.location.href = emailUrl
    
    // Close modal after a short delay to ensure email client opens
    setTimeout(() => {
      onClose()
    }, 300)
  }

  const handleLogout = () => {
    // Close the settings modal first so portals/scroll state are restored
    try {
      if (typeof onClose === 'function') onClose()
    } catch (err) {
      console.error('Error closing settings modal before logout:', err)
    }

    // Clear both new and old auth systems
    localStorage.removeItem('auth')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userId')

    // Notify the app about auth state change so Header (and others) update
    window.dispatchEvent(new Event('authStateChanged'))

    // Navigate to login page
    try {
      navigate('/login')
    } catch (err) {
      // Fallback to full reload if navigate isn't available for some reason
      window.location.href = '/login'
    }
  }

  const handleNavigate = (path) => {
    navigate(path)
    onClose()
  }

  if (!isOpen) {
    // Fire event to restore scroll when modal closes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('settingsModalClose'));
    }
    return null;
  }

  // Add a unique key to prevent duplicate rendering
  const modalKey = `settings-modal-${userEmail}-${Date.now()}`;
  const modal = 
  <>
      {/* Mobile backdrop blur except header */}
      {mobileMode && isFullWidthMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-md cursor-pointer"
          style={{ top: `${headerOffset}px` }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isInitializing) onClose();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            if (!isInitializing) onClose();
          }}
        />
      )}
        <div
        ref={settingsRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={
          mobileMode
            ? (isFullWidthMobile ? 'fixed z-50 flex items-end sm:items-center justify-center px-4 pointer-events-none' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm no-mobile-backdrop p-4')
            : 'absolute top-full right-0 mt-2 w-80 sm:w-96 p-3 z-50 desktop-offset'
        }
        style={{
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          ...(isFullWidthMobile ? {
            top: '64px',
            left: 0,
            right: 0,
            bottom: '64px',
            height: 'auto'
          } : {})
        }}
      >
        <div 
          className={(isFullWidthMobile ? 'inner-panel pointer-events-auto' : 'settings-glass-card no-mobile-backdrop pointer-events-auto') + ' rounded-xl shadow-lg overflow-hidden w-full max-w-sm mx-auto flex flex-col group rounded-t-2xl sm:rounded-xl'} 
          style={{ 
            boxShadow: '0 8px 28px rgba(2,6,23,0.06)',
            background: isFullWidthMobile ? '#ffffff' : undefined,
            maxHeight: isFullWidthMobile ? 'calc(100vh - 128px)' : '90vh',
            overflowY: isFullWidthMobile ? 'auto' : 'auto'
          }}
          onMouseEnter={() => {
            // Add class to body for combined hover effect
            if (!isMobile && typeof document !== 'undefined') {
              document.body.classList.add('settings-hover-active');
            }
          }}
          onMouseLeave={() => {
            // Remove class from body
            if (!isMobile && typeof document !== 'undefined') {
              document.body.classList.remove('settings-hover-active');
            }
          }}
        >
        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isInitializing) onClose();
          }}
          className={`absolute z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 active:bg-gray-300 transition-colors touch-manipulation ${isFullWidthMobile ? 'top-3 right-3 sm:top-4 sm:right-4' : 'top-3 right-3'}`}
          aria-label="Close settings"
          style={{ touchAction: 'manipulation', boxSizing: 'border-box' }}
        >
          <svg 
            className="w-4 h-4 text-gray-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

      {/* Header */}
      <div className="px-4 sm:px-4 py-3 sm:py-4 border-b border-[#e7edf4] hover:bg-gray-50/50 transition-colors duration-200">
        <div className="flex items-center gap-3 pr-6">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
            <span className="text-base font-bold text-yellow-600 group-hover:text-yellow-700 transition-colors duration-200">
              {userEmail?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[#0b1220] font-semibold text-sm truncate group-hover:text-black transition-colors duration-200">{userEmail}</h3>
            <p className="text-[#475569] text-xs capitalize group-hover:text-[#374151] transition-colors duration-200">{userRole} Account</p>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div 
        className="px-3 sm:px-4 py-3 sm:py-4 space-y-4 sm:space-y-5 flex-1 overflow-y-auto overflow-x-hidden smooth-scroll settings-content"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          WebkitTapHighlightColor: 'transparent',
          scrollBehavior: 'smooth',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {/* Account Section */}
        <div>
          <h4 className="text-sm font-semibold text-[#111418] group-hover:text-[#0b1220] mb-2 flex items-center gap-2 transition-colors duration-200">
            <svg className="w-4 h-4 group-hover:text-yellow-600 transition-colors duration-200" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            Account
          </h4>
          <div className="space-y-2">
            {/* Add Signature Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSignatureModal(true);
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

            {/* Reset Password Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowPasswordModal(true);
                setPasswordError('');
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

        {/* Notifications Section */}
        <div className="border-t border-[#e7edf4] pt-3">
          <h4 className="text-sm font-semibold text-[#111418] group-hover:text-[#0b1220] mb-2 flex items-center gap-2 transition-colors duration-200">
            <svg className="w-4 h-4 group-hover:text-yellow-600 transition-colors duration-200" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            Notifications
          </h4>

          {/* Notification Status Banner */}
          {!notificationSupported && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-2">
              <p className="text-xs text-yellow-700 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Browser notifications not supported
              </p>
            </div>
          )}
          {notificationPermission === 'denied' && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-2">
              <p className="text-xs text-red-700 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Notifications blocked. Enable in browser settings.
              </p>
            </div>
          )}
          {notificationsEnabled && notificationPermission === 'granted' && (
            <div className="bg-green-50 border border-green-200 rounded-md p-2 mb-2">
              <p className="text-xs text-green-700 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Notifications enabled successfully!
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/6 min-h-[52px]">
              <div className="flex-1 pr-3 min-w-0">
                <p className="text-sm font-medium text-[#111418]">Push Notifications</p>
                <p className="text-xs text-[#60758a] mt-0.5">Get academic notifications</p>
              </div>
              <div className="flex-shrink-0 toggle-touch-area">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!notificationLoading && notificationSupported && notificationPermission !== 'denied') {
                      handleNotificationToggle();
                    }
                  }}
                  disabled={notificationLoading || !notificationSupported || notificationPermission === 'denied'}
                  className={`toggle-switch ${notificationsEnabled ? 'enabled' : 'disabled'} ${
                    notificationLoading ? 'toggle-loading' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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
              <div className="flex-1 pr-3 min-w-0">
                <p className="text-sm font-medium text-[#111418]">Email Notifications</p>
                <p className="text-xs text-[#60758a] mt-0.5">Receive academic updates via email</p>
              </div>
              <div className="flex-shrink-0 toggle-touch-area">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEmailNotificationToggle();
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
              onClick={() => {
                onClose();
                navigate('/contact');
              }}
              className="lg:hidden w-full flex items-center gap-3 p-3 rounded-lg bg-white/6 hover:bg-white/12 hover:shadow-sm active:bg-white/5 transition-all duration-200 text-left min-h-[52px] cursor-pointer group"
              style={{ touchAction: 'manipulation', pointerEvents: 'auto' }}
            >
              <svg className="w-4 h-4 text-[#60758a] group-hover:text-[#4a5568] flex-shrink-0 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm font-medium text-[#111418] group-hover:text-[#0b1220] flex-1 transition-colors duration-200">Contact Us</span>
              <svg className="w-4 h-4 text-[#60758a] group-hover:text-[#4a5568] group-hover:translate-x-1 flex-shrink-0 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
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

        {/* Logout Section */}
        <div className="border-t border-[#e7edf4] pt-3 mt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
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

      {/* Signature Modal */}
      {showSignatureModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation();
              setShowSignatureModal(false);
              setSignatureMode('draw');
              setUploadedSignature(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }
          }}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Add Your Signature</h2>
            <p className="text-sm text-gray-600 mb-5">This signature will be used in generated PDFs</p>
            
            {/* Mode Tabs */}
            <div className="flex gap-2 mb-5 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSignatureMode('draw');
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => { e.stopPropagation(); }}
                className={`flex-1 py-2.5 px-4 rounded-md font-semibold text-sm transition-all ${
                  signatureMode === 'draw'
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ✍️ Draw
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSignatureMode('upload');
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => { e.stopPropagation(); }}
                className={`flex-1 py-2.5 px-4 rounded-md font-semibold text-sm transition-all ${
                  signatureMode === 'upload'
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📤 Upload
              </button>
            </div>

            {/* Draw Mode */}
            {signatureMode === 'draw' && (
              <div className="mb-5 border-2 border-gray-300 rounded-xl overflow-hidden bg-white" style={{ height: '160px' }}>
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={160}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-full cursor-crosshair"
                  style={{ touchAction: 'none', display: 'block' }}
                />
              </div>
            )}

            {/* Upload Mode */}
            {signatureMode === 'upload' && (
              <div className="mb-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="signature-upload"
                />
                
                {!uploadedSignature ? (
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
                ) : (
                  <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white flex items-center justify-center" style={{ height: '160px' }}>
                    <img
                      src={uploadedSignature}
                      alt="Uploaded signature"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearSignature();
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => { e.stopPropagation(); }}
                className="flex-1 px-4 py-2.5 border-2 border-gray-400 text-gray-700 rounded-lg hover:bg-gray-100 active:bg-gray-200 font-semibold text-sm transition-colors"
              >
                Clear
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSignatureModal(false);
                  setSignatureMode('draw');
                  setUploadedSignature(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => { e.stopPropagation(); }}
                className="flex-1 px-4 py-2.5 border-2 border-gray-400 text-gray-700 rounded-lg hover:bg-gray-100 active:bg-gray-200 font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  saveSignature();
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => { e.stopPropagation(); }}
                className="flex-1 px-4 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 active:bg-yellow-700 font-semibold text-sm transition-colors shadow-md hover:shadow-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.currentTarget === e.target) {
              setShowPasswordModal(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setPasswordError('');
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Reset Password</h2>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors sm:hidden"
                aria-label="Close"
                style={{ touchAction: 'manipulation' }}
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {passwordError && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 mb-4">
                <p className="text-xs sm:text-sm text-red-700 font-medium">{passwordError}</p>
              </div>
            )}

            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Enter current password"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-500 focus:outline-none transition-all text-sm sm:text-base"
                  autoComplete="current-password"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Enter new password (min. 6 characters)"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-500 focus:outline-none transition-all text-sm sm:text-base"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Confirm new password"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-500 focus:outline-none transition-all text-sm sm:text-base"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError('');
                }}
                className="flex-1 px-4 py-2.5 sm:py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 font-semibold text-sm transition-colors touch-manipulation"
                style={{ touchAction: 'manipulation' }}
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePasswordReset();
                }}
                disabled={passwordLoading}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 active:bg-yellow-700 font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg touch-manipulation"
                style={{ touchAction: 'manipulation' }}
              >
                {passwordLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
      </div>
    </>

  // If mobile and we want to portal, render into document.body to avoid stacking/transform issues
  // Portal only when in mobile mode to avoid stacking/transform issues.
  if (mobileMode && typeof document !== 'undefined') {
    // Clean up any existing portals before creating a new one
    const existingPortal = document.getElementById('settings-portal');
    if (existingPortal) {
      existingPortal.remove();
    }
    
    // Create a new portal container
    const portalContainer = document.createElement('div');
    portalContainer.id = 'settings-portal';
    portalContainer.setAttribute('key', modalKey);
    document.body.appendChild(portalContainer);
    
    return ReactDOM.createPortal(modal, portalContainer);
  } else {
    return modal;
  }
}

export default Settings
