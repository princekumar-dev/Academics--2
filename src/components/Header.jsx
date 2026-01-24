import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import apiClient from '../utils/apiClient'
import { Bell } from 'lucide-react'
import Settings from './Settings'
import NotificationRequests from './NotificationRequests'
import ResponsiveImage from './ResponsiveImage'

function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  // Treat both login and signup as 'auth' pages where we show only the logo
  const isAuthPage = ['/login', '/signup'].includes(location.pathname)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [swStatus, setSwStatus] = useState('unknown')
  const [isSmallViewport, setIsSmallViewport] = useState(() => {
    if (typeof window === 'undefined') return false
    // Tailwind's `lg` breakpoint is 1024px. We consider "small viewport"
    // anything under that so mobile/modal behavior is toggled correctly.
    return window.matchMedia('(max-width: 1023px)').matches
  })

  // Helper function to get active link styles
  const getLinkClassName = (path) => {
    let isActive = location.pathname === path
    
    // No special cases needed for academics system
    
    return isActive 
      ? "text-[#000000] text-sm font-bold leading-normal" 
      : "text-[#111418] text-sm font-medium leading-normal hover:text-[#000000] hover:font-bold transition-all duration-200"
  }

  const pollIntervalRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  useEffect(() => {
    checkAuthStatus();
    const updateViewport = () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => {
        setIsSmallViewport(window.matchMedia('(max-width: 1023px)').matches);
      }, 120); // debounce resize for 120ms
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    const handleAuthChange = () => {
      checkAuthStatus();
      try {
        setIsMobileMenuOpen(false);
        setIsSettingsOpen(false);
      } catch (err) {}
    };
    window.addEventListener('authStateChanged', handleAuthChange);
    const handleNotificationsUpdated = () => {
      try {
        if (isLoggedIn && userEmail && userRole) fetchUnreadCount(userEmail, userRole, true)
      } catch (e) {}
    }
    window.addEventListener('notificationsUpdated', handleNotificationsUpdated);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
      if (isLoggedIn && userEmail && (userRole === 'hod' || userRole === 'staff' || userRole === 'admin')) {
        if (typeof requestIdleCallback === 'function') {
          try {
            requestIdleCallback(() => fetchUnreadCount(userEmail, userRole), { timeout: 2000 });
          } catch (e) {
            fetchUnreadCount(userEmail, userRole);
          }
        } else {
          fetchUnreadCount(userEmail, userRole);
        }
      }
    }, 30000);
    return () => {
      window.removeEventListener('authStateChanged', handleAuthChange);
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdated);
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      if (resizeTimeoutRef.current) { clearTimeout(resizeTimeoutRef.current); resizeTimeoutRef.current = null; }
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isLoggedIn, userEmail, userRole]);

  // Service worker status for admin users
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        if (regs && regs.length > 0) {
          setSwStatus('registered')
        } else if (navigator.serviceWorker.controller) {
          setSwStatus('controlled')
        } else {
          setSwStatus('none')
        }
      }).catch(() => setSwStatus('error'))

      const onMessage = (ev) => {
        try {
          const msg = ev?.data
          if (!msg) return
          if (msg.type === 'SW_STATUS') setSwStatus(msg.status || 'unknown')
        } catch (e) {}
      }
      navigator.serviceWorker.addEventListener && navigator.serviceWorker.addEventListener('message', onMessage)
      return () => {
        navigator.serviceWorker.removeEventListener && navigator.serviceWorker.removeEventListener('message', onMessage)
      }
    }
  }, [isLoggedIn, userRole])

  const checkAuthStatus = () => {
    const auth = localStorage.getItem('auth')
    if (auth) {
      try {
        const authData = JSON.parse(auth)
        setIsLoggedIn(authData.isAuthenticated || false)
        setUserEmail(authData.email || '')
        setUserRole(authData.role || '')
        
        // Fetch notification count if HOD, staff, or admin
        if ((authData.role === 'hod' || authData.role === 'staff' || authData.role === 'admin') && authData.email) {
          fetchUnreadCount(authData.email, authData.role)
        }
      } catch (error) {
        console.error('Error parsing auth data:', error)
        // Fallback to old auth system
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true'
        const email = localStorage.getItem('userEmail')
        const role = localStorage.getItem('userRole')
        
        setIsLoggedIn(loggedIn)
        setUserEmail(email || '')
        setUserRole(role || '')
        
        if ((role === 'hod' || role === 'staff' || role === 'admin') && email) {
          fetchUnreadCount(email, role)
        }
      }
    } else {
      // Fallback to old auth system
      const loggedIn = localStorage.getItem('isLoggedIn') === 'true'
      const email = localStorage.getItem('userEmail')
      const role = localStorage.getItem('userRole')
      
      setIsLoggedIn(loggedIn)
      setUserEmail(email || '')
      setUserRole(role || '')
      
      if ((role === 'hod' || role === 'staff' || role === 'admin') && email) {
        fetchUnreadCount(email, role)
      }
    }
  }

  const fetchUnreadCount = async (email, role, force = false) => {
    try {
      if (role === 'hod') {
        // HOD: Count pending staff approval requests + leave requests
        const auth = JSON.parse(localStorage.getItem('auth') || '{}')
        const hodId = auth?.id || auth.user?.id
        const department = auth?.department || auth.user?.department
        
        if (hodId && department) {
          const opts = force ? { cache: false, dedupe: false } : {}
          const [staffData, leaveData] = await Promise.all([
            apiClient.get(`/api/staff-approval?action=pending&hodId=${hodId}`, opts),
            apiClient.get(`/api/leaves?department=${department}&type=leave`, opts)
          ])
          
          let staffCount = 0
          let leaveCount = 0
          
          if (staffData.success && staffData.requests) {
            staffCount = staffData.requests.length
          }
          
          if (leaveData.success && leaveData.requests) {
            leaveCount = leaveData.requests.filter(r => r.status === 'requested').length
          }
          
          setUnreadCount(staffCount + leaveCount)
        }
      } else if (role === 'staff') {
        // Staff: Count pending approval status + late arrival requests
        const auth = JSON.parse(localStorage.getItem('auth') || '{}')
        const year = auth?.year || auth.user?.year
        const section = auth?.section || auth.user?.section
        const department = auth?.department || auth.user?.department
        
        let totalCount = 0
        
        // Check account approval status
        const notificationData = await apiClient.get(`/api/notifications?userEmail=${email}`, force ? { cache: false, dedupe: false } : {})
        if (notificationData?.success) {
          const ownRequest = notificationData.notifications.find(
            n => n.type === 'staff_account_approval' && 
            n.data?.staffEmail === email &&
            !n.read &&
            (n.data?.status === 'approved' || n.data?.status === 'rejected')
          )
          if (ownRequest) totalCount += 1
        }
        
        // Check late arrival requests
        if (year && section && department) {
          try {
            const lateData = await apiClient.get(`/api/leaves?department=${department}&type=late&status=requested`, force ? { cache: false, dedupe: false } : {})
            
            if (lateData.success && lateData.requests) {
              const lateCount = (lateData.requests || [])
                .filter(r => r.studentDetails?.year === year && r.studentDetails?.section === section)
                .length
              totalCount += lateCount
            }
          } catch (error) {
            console.error('Error fetching late arrivals:', error)
          }
        }
        
        setUnreadCount(totalCount)
      } else if (role === 'admin') {
        // Admin: count unread notifications stored for the admin account
        const data = await apiClient.get(`/api/notifications?userEmail=${encodeURIComponent(email)}`, force ? { cache: false, dedupe: false } : {})
        if (data?.success && Array.isArray(data.notifications)) {
          const unread = data.notifications.filter(n => !n.read).length
          setUnreadCount(unread)
        }
      }
    } catch (error) {
      console.error('Error fetching notification count:', error)
    }
  }

  const handleLogout = () => {
    // Clear both new and old auth systems
    localStorage.removeItem('auth')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userId')
    
    setIsLoggedIn(false)
    setUserEmail('')
    setUserRole('')
    
    // Trigger auth state change event
    window.dispatchEvent(new Event('authStateChanged'))
    
    // Close any open menus/settings
    try {
      setIsMobileMenuOpen(false)
      setIsSettingsOpen(false)
    } catch (err) {
      // ignore
    }

    // Navigate to login page
    try {
      navigate('/login')
    } catch (err) {
      window.location.href = '/login'
    }
  }

  const handleSearchInput = async (value) => {
    setSearchQuery(value)
    
    if (!value.trim()) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }
    
    setIsSearching(true)
    setShowSearchDropdown(true)
    
    try {
      const query = value.trim().toLowerCase()
      const auth = localStorage.getItem('auth')
      const authData = auth ? JSON.parse(auth) : null
      
      if (!authData) {
        setSearchResults([])
        setIsSearching(false)
        return
      }
      
      const results = []
      
      // Search marksheets
      if (authData.role === 'staff' || authData.role === 'hod') {
        try {
          let marksheetsUrl = '/api/marksheets?includeAll=true'
          if (authData.role === 'staff') {
            const staffId = authData._id || authData.id || localStorage.getItem('userId')
            marksheetsUrl += `&staffId=${staffId}`
          } else if (authData.role === 'hod') {
            marksheetsUrl += `&department=${authData.department}`
          }
          
          const marksheetsData = await apiClient.get(marksheetsUrl)
          
          if (marksheetsData.success) {
            const matchedMarksheets = marksheetsData.marksheets.filter(m => {
              const name = (m.studentDetails?.name || '').toLowerCase()
              const regNo = (m.studentDetails?.regNumber || '').toLowerCase()
              const exam = (m.examinationName || '').toLowerCase()
              return name.includes(query) || regNo.includes(query) || exam.includes(query)
            }).slice(0, 5)
            
            matchedMarksheets.forEach(m => {
              results.push({
                type: 'marksheet',
                id: m._id,
                title: m.studentDetails?.name || 'Unknown Student',
                subtitle: `${m.studentDetails?.regNumber || ''} • ${m.examinationName || ''}`,
                status: m.status,
                link: `/marksheets/${m._id}`
              })
            })
          }
        } catch (err) {
          console.error('Error searching marksheets:', err)
        }
      }
      
      // Search users (HOD only)
      if (authData.role === 'hod') {
        try {
          const usersData = await apiClient.get(`/api/users?department=${authData.department}`)
          
          if (usersData.success) {
            const matchedUsers = usersData.users.filter(u => {
              const name = (u.name || '').toLowerCase()
              const email = (u.email || '').toLowerCase()
              return name.includes(query) || email.includes(query)
            }).slice(0, 3)
            
            matchedUsers.forEach(u => {
              results.push({
                type: 'user',
                id: u._id,
                title: u.name || u.email,
                subtitle: `${u.role || 'Staff'} • ${u.email || ''}`,
                link: '/department-overview'
              })
            })
          }
        } catch (err) {
          console.error('Error searching users:', err)
        }
      }
      
      setSearchResults(results)
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    }
    
    setIsSearching(false)
  }
  
  const handleSearch = (e) => {
    e?.preventDefault()
    if (searchQuery.trim() && searchResults.length > 0) {
      // Navigate to first result
      navigate(searchResults[0].link)
      setSearchQuery('')
      setSearchResults([])
      setShowSearchDropdown(false)
    } else if (searchQuery.trim()) {
      // Navigate to records page with search
      navigate(`/records?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setShowSearchDropdown(false)
    }
  }
  
  const handleResultClick = (e, link) => {
    e.preventDefault()
    e.stopPropagation()
    setShowSearchDropdown(false)
    setSearchQuery('')
    setSearchResults([])
    // Use setTimeout to ensure state updates before navigation
    setTimeout(() => {
      navigate(link)
    }, 0)
  }

  return (
    <header 
      className="sticky top-0 z-50 glass-card flex items-center justify-between whitespace-nowrap px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 py-3 sm:py-4 mx-2 sm:mx-3 md:mx-4 mt-2 sm:mt-3 md:mt-4"
      onMouseEnter={() => {
        // Add class to body for bidirectional hover effect
        if (typeof document !== 'undefined') {
          document.body.classList.add('header-hover-active');
        }
      }}
      onMouseLeave={() => {
        // Remove class from body
        if (typeof document !== 'undefined') {
          document.body.classList.remove('header-hover-active');
        }
      }}
    >
      {/* Left Section: Logo, Brand, and Navigation */}
      <div className="flex items-center gap-3 sm:gap-4 md:gap-6 lg:gap-8 flex-1 min-w-0">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="size-9 sm:size-10 md:size-10">
            {/* Responsive logo with AVIF/WebP fallbacks */}
            <ResponsiveImage src="/images/mseclogo.png" alt="MSEC Logo" className="w-full h-full" sizes="(max-width:640px) 64px, 128px" widths={[64,128,256]} lazy={true} />
          </div>
          <h2 className="text-base sm:text-lg md:text-xl font-bold leading-tight tracking-[-0.015em] whitespace-nowrap">
            <span className="text-[#111418]">MSEC</span> <span className="wave-text">Academics</span>
          </h2>
        </div>

        {/* SW status removed from header UI */}

  {/* Desktop Navigation - Close to Logo */}
  {!isAuthPage && (
          <nav className="hidden lg:flex items-center gap-4 xl:gap-5 2xl:gap-6 flex-shrink min-w-0">
            {isLoggedIn && userRole === 'student' ? (
              <>
                <Link className={getLinkClassName('/student')} to="/student" title="My Marksheets">My Marksheets</Link>
                <Link className={getLinkClassName('/leave')} to="/leave" title="Leave/Late">Leave/Late</Link>
              </>
            ) : (
              <Link className={getLinkClassName('/home')} to="/home" title="Dashboard">Dashboard</Link>
            )}
            {isLoggedIn && userRole === 'staff' && (
              <>
                <Link className={getLinkClassName('/marksheets')} to="/marksheets" title="Marksheets">Marksheets</Link>
                <Link className={getLinkClassName('/dispatch-requests')} to="/dispatch-requests" title="Dispatch Requests">
                  <span className="hidden xl:inline">Dispatch Requests</span>
                  <span className="xl:hidden">Dispatch</span>
                </Link>
                <Link className={getLinkClassName('/records')} to="/records" title="Records">Records</Link>
              </>
            )}
            {isLoggedIn && userRole === 'hod' && (
              <>
                <Link className={getLinkClassName('/department-overview')} to="/department-overview" title="Department Overview">
                  <span className="hidden xl:inline">Department Overview</span>
                  <span className="xl:hidden">Department</span>
                </Link>
                <Link className={getLinkClassName('/approval-requests')} to="/approval-requests" title="Approval Requests">
                  <span className="hidden xl:inline">Approval Requests</span>
                  <span className="xl:hidden">Approvals</span>
                </Link>
                <Link className={getLinkClassName('/reports')} to="/reports" title="Reports">Reports</Link>
              </>
            )}
            {!isLoggedIn || userRole !== 'student' ? (
              <Link className={getLinkClassName('/contact')} to="/contact" title="Contact">Contact</Link>
            ) : null}
          </nav>
        )}
      </div>

      {/* Right Section: Search and Actions */}
  {!isAuthPage && (
        <div className="hidden lg:flex items-center gap-2 lg:gap-3 xl:gap-4 flex-shrink-0">
          <form onSubmit={handleSearch} className="relative !h-9 lg:!h-10 w-40 lg:w-48 xl:w-64">
            {/* Glass-morphism input: translucent bg, subtle border, backdrop blur */}
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#60758a] pointer-events-none z-10">
              <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" fill="currentColor" viewBox="0 0 256 256" className="lg:w-5 lg:h-5">
                <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 300)}
              placeholder="Search students, exams..."
              className="form-input w-full h-full text-[#111418] focus:outline-0 focus:ring-0 border border-white/10 bg-white/30 backdrop-blur-sm placeholder:text-[#60758a] pl-9 lg:pl-10 pr-3 text-xs lg:text-sm font-normal leading-normal rounded-lg lg:rounded-xl relative z-0"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(e)
                }
              }}
            />
            
            {/* Search Results Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Searching...</div>
                ) : (
                  <>
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => handleResultClick(e, result.link)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="w-full px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            result.type === 'marksheet' ? 'bg-blue-100 text-blue-600' :
                            result.type === 'user' ? 'bg-green-100 text-green-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {result.type === 'marksheet' ? '📄' :
                             result.type === 'user' ? '👤' : '📋'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-sm truncate">{result.title}</div>
                            <div className="text-xs text-gray-500 truncate">{result.subtitle}</div>
                            {result.status && (
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                                result.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                                result.status === 'verified_by_staff' ? 'bg-blue-100 text-blue-700' :
                                result.status === 'dispatch_requested' ? 'bg-yellow-100 text-yellow-700' :
                                result.status === 'approved_by_hod' ? 'bg-green-100 text-green-700' :
                                result.status === 'dispatched' ? 'bg-purple-100 text-purple-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {result.status.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                    {searchQuery && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setShowSearchDropdown(false)
                          setSearchQuery('')
                          setTimeout(() => {
                            navigate(`/records?search=${encodeURIComponent(searchQuery.trim())}`)
                          }, 0)
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left text-sm text-blue-600 font-medium transition-colors"
                      >
                        View all results for "{searchQuery}"
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </form>
          
          <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
            {!isLoggedIn ? (
              <Link
                to="/login"
                className="flex min-w-[60px] lg:min-w-[70px] cursor-pointer items-center justify-center overflow-hidden rounded-lg lg:rounded-xl h-9 lg:h-10 px-3 lg:px-4 bg-theme-gold hover:bg-theme-gold-500 text-white text-xs lg:text-sm font-bold leading-normal tracking-[0.015em] whitespace-nowrap transition-all duration-200"
              >
                <span className="truncate">Login</span>
              </Link>
            ) : (
              <div className="flex items-center gap-1 lg:gap-2 relative">
                {/* Desktop Bell Notification Icon */}
                <button
                  onClick={() => setIsNotificationsOpen(true)}
                  className="hidden lg:flex items-center justify-center w-9 lg:w-10 h-9 lg:h-10 rounded-lg hover:bg-[#f0f2f5] transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5 text-[#60758a] hover:text-theme-gold transition-colors" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                
                <button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="flex items-center gap-2 px-2 lg:px-3 h-9 lg:h-10 rounded-lg hover:bg-[#f0f2f5] transition-colors group"
                  title="Settings"
                >
                  <div className="w-7 lg:w-8 h-7 lg:h-8 rounded-full bg-theme-gold-gradient flex items-center justify-center flex-shrink-0">
                    <span className="text-xs lg:text-sm font-bold text-white">
                      {(() => {
                        if (userRole === 'student') {
                          try {
                            const auth = JSON.parse(localStorage.getItem('auth') || '{}')
                            return auth?.name?.charAt(0).toUpperCase() || 'S'
                          } catch {
                            return 'S'
                          }
                        }
                        return userEmail?.charAt(0).toUpperCase()
                      })()}
                    </span>
                  </div>
                  <span className="text-xs lg:text-sm font-medium text-[#111418] hidden xl:inline truncate max-w-[120px] lg:max-w-[150px] group-hover:text-theme-gold">
                    {userEmail}
                  </span>
                  <svg 
                    className={`w-3 lg:w-4 h-3 lg:h-4 text-[#60758a] transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Notification and Profile Buttons */}
  {!isAuthPage && (
        <div className="lg:hidden flex items-center gap-1">
          {/* Mobile Bell Notification Icon */}
          {isLoggedIn && (
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="flex items-center justify-center p-1.5 sm:p-2 text-[#111418] hover:bg-gray-100 rounded-lg transition-colors duration-200 flex-shrink-0 relative"
              aria-label="Notifications"
            >
              <Bell className="w-5 sm:w-6 h-5 sm:h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
          
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-center p-1.5 sm:p-2 text-[#111418] hover:bg-gray-100 rounded-lg transition-colors duration-200 flex-shrink-0"
            aria-label="Open settings"
          >
            <svg className="w-5 sm:w-6 h-5 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
      )}

      {/* Mobile Menu */}
  {!isAuthPage && isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md border-b border-[#f0f2f5] shadow-lg rounded-b-2xl mx-2 sm:mx-3 md:mx-4">
          <div className="flex flex-col p-4 sm:p-5 space-y-4 sm:space-y-5">
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="flex flex-col w-full">
              <div className="flex w-full items-stretch rounded-xl h-11 sm:h-12">
                  <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 sm:pl-4 text-[#60758a] pointer-events-none z-10">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" fill="currentColor" viewBox="0 0 256 256" className="sm:w-5 sm:h-5">
                        <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search"
                      className="form-input w-full h-full text-[#111418] focus:outline-0 focus:ring-0 border border-gray-200 bg-gray-50 placeholder:text-[#60758a] pl-10 sm:pl-12 pr-3 sm:pr-4 text-sm sm:text-base font-normal leading-normal rounded-xl relative z-0"
                    />
                  </div>
                </div>
            </form>

            {/* Mobile Navigation Links */}
            <nav className="flex flex-col space-y-2 sm:space-y-3">
              <Link className="text-[#111418] text-sm sm:text-base font-medium py-2.5 sm:py-3 px-3 sm:px-4 hover:text-theme-gold-500 hover:bg-theme-gold-50 rounded-lg transition-all duration-200 mobile-nav-item" to="/home" onClick={() => setIsMobileMenuOpen(false)}>
                Dashboard
              </Link>
              {isLoggedIn && userRole === 'staff' && (
                <>
                  <Link className="text-[#111418] text-sm sm:text-base font-medium py-2.5 sm:py-3 px-3 sm:px-4 hover:text-theme-gold-500 hover:bg-theme-gold-50 rounded-lg transition-all duration-200 mobile-nav-item" to="/marksheets" onClick={() => setIsMobileMenuOpen(false)}>
                    Marksheets
                  </Link>
                  <Link className="text-[#111418] text-sm sm:text-base font-medium py-2.5 sm:py-3 px-3 sm:px-4 hover:text-theme-gold-500 hover:bg-theme-gold-50 rounded-lg transition-all duration-200 mobile-nav-item" to="/dispatch-requests" onClick={() => setIsMobileMenuOpen(false)}>
                    Dispatch Requests
                  </Link>
                  <Link className="text-[#111418] text-sm sm:text-base font-medium py-2.5 sm:py-3 px-3 sm:px-4 hover:text-theme-gold-500 hover:bg-theme-gold-50 rounded-lg transition-all duration-200 mobile-nav-item" to="/records" onClick={() => setIsMobileMenuOpen(false)}>
                    Records
                  </Link>
                </>
              )}
              {isLoggedIn && userRole === 'hod' && (
                <>
                  <Link className="text-[#111418] text-sm sm:text-base font-medium py-2.5 sm:py-3 px-3 sm:px-4 hover:text-theme-gold-500 hover:bg-theme-gold-50 rounded-lg transition-all duration-200 mobile-nav-item" to="/department-overview" onClick={() => setIsMobileMenuOpen(false)}>
                    Department Overview
                  </Link>
                  <Link className="text-[#111418] text-sm sm:text-base font-medium py-2.5 sm:py-3 px-3 sm:px-4 hover:text-theme-gold-500 hover:bg-theme-gold-50 rounded-lg transition-all duration-200 mobile-nav-item" to="/approval-requests" onClick={() => setIsMobileMenuOpen(false)}>
                    Approval Requests
                  </Link>
                  <Link className="text-[#111418] text-sm sm:text-base font-medium py-2.5 sm:py-3 px-3 sm:px-4 hover:text-theme-gold-500 hover:bg-theme-gold-50 rounded-lg transition-all duration-200 mobile-nav-item" to="/reports" onClick={() => setIsMobileMenuOpen(false)}>
                    Reports
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile Actions */}
            <div className="flex flex-col gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-[#f0f2f5]">
              {isLoggedIn ? (
                <>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(!isSettingsOpen)
                      setIsMobileMenuOpen(false)
                    }}
                    className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                  >
                    <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-theme-gold-gradient flex items-center justify-center flex-shrink-0">
                      <span className="text-sm sm:text-base font-bold text-white">
                        {(() => {
                          if (userRole === 'student') {
                            try {
                              const auth = JSON.parse(localStorage.getItem('auth') || '{}')
                              return auth?.name?.charAt(0).toUpperCase() || 'S'
                            } catch {
                              return 'S'
                            }
                          }
                          return userEmail?.charAt(0).toUpperCase()
                        })()}
                      </span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm sm:text-base font-medium text-[#111418] truncate">{userEmail}</p>
                      <p className="text-xs sm:text-sm text-[#60758a] capitalize">{userRole}</p>
                    </div>
                    <svg className="w-4 sm:w-5 h-4 sm:h-5 text-[#60758a] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  {userRole === 'staff' && (
                    <Link
                      to="/marksheets"
                      className="flex items-center justify-center rounded-xl h-11 sm:h-12 px-4 bg-theme-gold hover:bg-theme-gold-500 text-white text-sm sm:text-base font-bold mobile-btn tablet-btn desktop-btn transition-all duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Go to Marksheets
                    </Link>
                  )}
                  {userRole === 'hod' && (
                    <Link
                      to="/approval-requests"
                      className="flex items-center justify-center rounded-xl h-11 sm:h-12 px-4 bg-theme-gold hover:bg-theme-gold-500 text-white text-sm sm:text-base font-bold mobile-btn tablet-btn desktop-btn transition-all duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Approval Requests
                    </Link>
                  )}
                </>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Link
                    to="/login"
                    className="flex-1 flex items-center justify-center rounded-xl h-11 sm:h-12 px-4 bg-theme-gold hover:bg-theme-gold-500 text-white text-sm sm:text-base font-bold mobile-btn tablet-btn desktop-btn transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/login"
                    className="flex-1 flex items-center justify-center rounded-xl h-11 sm:h-12 px-4 border-2 border-theme-gold text-theme-gold hover:bg-theme-gold hover:text-white text-sm sm:text-base font-bold transition-all duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal - Rendered in Portal for Both Desktop and Mobile */}
      {isSettingsOpen && (
        <Settings 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          userEmail={userEmail}
          userRole={userRole}
          isMobile={isSmallViewport}
        />
      )}

      {/* Notification Requests Modal */}
      <NotificationRequests 
        isOpen={isNotificationsOpen}
        onClose={() => {
          setIsNotificationsOpen(false)
          if (userEmail && userRole) {
            fetchUnreadCount(userEmail, userRole)
          }
        }}
        setUnreadCount={setUnreadCount}
      />
    </header>
  )
}

export default Header