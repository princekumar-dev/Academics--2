import { useEffect, useMemo, useState } from 'react'
import apiClient from '../utils/apiClient'
import { getUserFriendlyMessage } from '../utils/apiErrorMessages'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import { getAccessBlockMeta, getAccessPolicy, getAccessWindowLabel } from '../utils/accessPolicy'

const LOGIN_TAB_STORAGE_KEY = 'msec:login_tab'

const getInitialLoginType = () => {
  try {
    const savedLoginType = localStorage.getItem(LOGIN_TAB_STORAGE_KEY)
    if (savedLoginType === 'student' || savedLoginType === 'staff') {
      return savedLoginType
    }
  } catch (e) {
    // Ignore storage errors and use default mode.
  }
  return 'staff'
}

const getMessageTone = (message) => {
  const normalizedMessage = String(message || '').toLowerCase()

  if (
    normalizedMessage.includes('waiting for hod approval') ||
    normalizedMessage.includes('wait for hod approval') ||
    normalizedMessage.includes('rejected by the hod')
  ) {
    return 'info'
  }

  return 'error'
}

const showLoginStatusAlert = ({ message, showError, showWarning }) => {
  if (getMessageTone(message) === 'info') {
    showWarning('Approval Pending', message)
    return
  }

  const normalizedMessage = String(message || '').toLowerCase()

  if (normalizedMessage.includes('invalid email')) {
    showError('Invalid Email', 'Invalid email address. Need help? Contact support@msec.edu.in')
    return
  }

  showError('Login Failed', message)
}

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    regNumber: '',
    loginType: getInitialLoginType()
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [isSendingLoginCode, setIsSendingLoginCode] = useState(false)
  const [isVerifyingLoginCode, setIsVerifyingLoginCode] = useState(false)
  const [isLoginCodeSent, setIsLoginCodeSent] = useState(false)
  const [isStaffEmailVerified, setIsStaffEmailVerified] = useState(false)
  const [loginVerificationToken, setLoginVerificationToken] = useState('')
  const navigate = useNavigate()
  const { showSuccess, showError, showWarning } = useAlert()
  const accessPolicy = getAccessPolicy()
  const accessBlocked = useMemo(() => {
    if (formData.loginType === 'student') {
      return getAccessBlockMeta('student')
    }

    // Admin and staff share the same login mode; final role-based window checks run on the server.
    return null
  }, [formData.loginType])
  const messageTone = useMemo(() => getMessageTone(error), [error])

  const switchLoginType = (nextType) => {
    const normalizedType = nextType === 'student' ? 'student' : 'staff'

    try {
      localStorage.setItem(LOGIN_TAB_STORAGE_KEY, normalizedType)
    } catch (e) {
      // Ignore storage errors and continue UI switch.
    }

    setFormData(prev => {
      if (normalizedType === 'student') {
        setIsLoginCodeSent(false)
        setIsStaffEmailVerified(false)
        setLoginVerificationToken('')
        setLoginCode('')
        return {
          ...prev,
          loginType: 'student',
          email: '',
          password: '',
          regNumber: ''
        }
      }

      setIsLoginCodeSent(false)
      setIsStaffEmailVerified(false)
      setLoginVerificationToken('')
      setLoginCode('')

      return {
        ...prev,
        loginType: 'staff',
        regNumber: '',
        password: ''
      }
    })
    if (error) setError('')
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target

    if (name === 'email' && value.trim().toLowerCase() !== formData.email.trim().toLowerCase()) {
      setIsLoginCodeSent(false)
      setIsStaffEmailVerified(false)
      setLoginVerificationToken('')
      setLoginCode('')
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const sendLoginVerificationCode = async () => {
    const normalizedEmail = formData.email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Please enter your email first.')
      return
    }

    if (!normalizedEmail.endsWith('@msec.edu.in')) {
      setError('Only @msec.edu.in email addresses are allowed.')
      return
    }

    setIsSendingLoginCode(true)
    setError('')

    try {
      const data = await apiClient.post('/api/users?action=email-verification', {
        mode: 'request',
        email: normalizedEmail,
        purpose: 'login'
      })

      if (!data?.success) {
        setError(data?.error || 'Unable to send login verification code.')
        return
      }

      setIsLoginCodeSent(true)
      if (data.developmentCode) {
        showWarning('Development OTP', `Verification code: ${data.developmentCode}`)
      }
    } catch (err) {
      setError(getUserFriendlyMessage(err, 'Unable to send login verification code.'))
    } finally {
      setIsSendingLoginCode(false)
    }
  }

  const verifyLoginCode = async () => {
    const normalizedEmail = formData.email.trim().toLowerCase()
    const candidateCode = loginCode.trim()
    if (!candidateCode) {
      setError('Please enter the verification code from your email.')
      return
    }

    setIsVerifyingLoginCode(true)
    setError('')

    try {
      const data = await apiClient.post('/api/users?action=email-verification', {
        mode: 'verify',
        email: normalizedEmail,
        purpose: 'login',
        code: candidateCode
      })

      if (!data?.success || !data?.verificationToken) {
        setError(data?.error || 'Invalid verification code.')
        return
      }

      setIsStaffEmailVerified(true)
      setLoginVerificationToken(data.verificationToken)
    } catch (err) {
      setError(getUserFriendlyMessage(err, 'Unable to verify code. Please try again.'))
    } finally {
      setIsVerifyingLoginCode(false)
    }
  }

  useEffect(() => {
    if (formData.loginType !== 'staff') return
    if (!isLoginCodeSent || isStaffEmailVerified || isVerifyingLoginCode) return
    if (loginCode.length !== 6) return
    verifyLoginCode()
  }, [loginCode, isLoginCodeSent, isStaffEmailVerified, isVerifyingLoginCode, formData.loginType])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const isStudent = formData.loginType === 'student'

    if (accessBlocked) {
      setError(accessBlocked.message)
      showError(accessBlocked.title, accessBlocked.message)
      setIsLoading(false)
      return
    }

    // Basic validation per mode
    if (isStudent) {
      if (!formData.regNumber || !formData.password) {
        const missing = !formData.regNumber ? 'registration number' : 'password'
        setError(`📝 Please enter your ${missing} to continue.`)
        setIsLoading(false)
        return
      }
    } else {
      if (!formData.email || !formData.password) {
        const missing = !formData.email ? 'email address' : 'password'
        setError(`📝 Please enter your ${missing} to continue.`)
        setIsLoading(false)
        return
      }
      const emailDomain = formData.email.toLowerCase().split('@')[1]
      if (emailDomain !== 'msec.edu.in') {
        setError('🏫 Only MSEC institutional emails are allowed. Use your @msec.edu.in email address.')
        setIsLoading(false)
        return
      }

      if (!isStaffEmailVerified || !loginVerificationToken) {
        setError('Please verify your email before signing in.')
        setIsLoading(false)
        return
      }
    }

    try {
      const payload = {
        ...formData,
        email: formData.email.trim().toLowerCase()
      }
      if (formData.loginType === 'staff') {
        payload.emailVerificationToken = loginVerificationToken
      }
      const data = await apiClient.post('/api/auth', payload)

      if (data.success) {
        // Set authentication state in localStorage
        const authData = {
          isAuthenticated: true,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          department: data.user.department,
          id: data.user.id,
          year: data.user.year,
          section: data.user.section,
          regNumber: data.user.regNumber,
          phoneNumber: data.user.phoneNumber,
          parentPhoneNumber: data.user.parentPhoneNumber,
          eSignature: data.user.eSignature || null,
          loginTime: new Date().toISOString()
        }
        localStorage.setItem('auth', JSON.stringify(authData))

        // Also save individual items for backward compatibility
        localStorage.setItem('isLoggedIn', 'true')
        if (data.user.email) localStorage.setItem('userEmail', data.user.email)
        localStorage.setItem('userRole', data.user.role)
        localStorage.setItem('userId', data.user.id)

        // Try to fetch canonical profile for staff/hod/admin so the welcome message matches dashboard
        let displayName = data.user.name
        if (data.user.role !== 'student') {
          try {
            const profile = await apiClient.get(`/api/users?action=profile&userId=${data.user.id}`)
            if (profile?.success && profile.user) {
              const merged = { ...authData, ...profile.user }
              localStorage.setItem('auth', JSON.stringify(merged))
              displayName = profile.user.name || displayName
            }
          } catch (err) {
            // Non-fatal - proceed with server-returned name
          }
        }

        // Show success alert with the canonical name when available
        showSuccess('Welcome Back!', `Logged in as ${displayName}`)

        // Redirect to root page which will handle role-based routing
        setTimeout(() => {
          navigate('/', { replace: true })
          // Trigger a custom event to update header authentication state
          window.dispatchEvent(new Event('authStateChanged'))
        }, 500)
      } else {
        const errorMsg = data.error || '🔐 Invalid credentials. Please check your email and password, then try again.'
        setError(errorMsg)
        showLoginStatusAlert({ message: errorMsg, showError, showWarning })
      }
    } catch (error) {
      const errorMsg = getUserFriendlyMessage(error, 'Login failed. Please try again or contact support.')
      setError(errorMsg)
      showLoginStatusAlert({ message: errorMsg, showError, showWarning })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8">
      <style>
        {`
          @keyframes waveButtonAnimation {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
          }
          
          .login-wave-button {
            background: linear-gradient(90deg, var(--theme-gold-600), var(--theme-gold-300), var(--theme-gold-600), var(--theme-gold-300));
            background-size: 300% 100%;
            animation: waveButtonAnimation 3s ease-in-out infinite;
            transition: all 0.3s ease;
          }
          
          .login-wave-button:hover {
            animation-duration: 1.5s;
          }

          .mail-send-btn {
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.85), rgba(16, 185, 129, 0.9));
          }
        `}
      </style>

      <div className="relative z-10 w-full max-w-md mx-auto">
        {accessBlocked && (
          <div className="mb-4 sm:mb-6 w-full">
            <div className="rounded-2xl sm:rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl shadow-2xl p-4 sm:p-6">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-white text-base sm:text-lg font-extrabold">{accessBlocked.title}</h3>
                  <p className="text-white/90 text-xs sm:text-sm mt-1 leading-relaxed">{accessBlocked.message}</p>
                  <p className="text-white/80 text-[11px] sm:text-xs mt-2.5 sm:mt-3">Allowed time: {getAccessWindowLabel()} (IST)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="w-full relative z-10">
          <div className="backdrop-blur-md bg-white/20 border border-white/30 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl">
            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 rounded-full mb-4 sm:mb-6">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white mb-1.5 sm:mb-2">Welcome Back</h1>
              <p className="text-gray-100 text-sm sm:text-lg">Sign in to your MSEC Academics account</p>
            </div>

            {/* Status Message */}
            {error && (
              <div className="mb-6">
                <div className={`backdrop-blur-sm p-4 border-l-4 rounded-lg ${
                  messageTone === 'info'
                    ? 'bg-yellow-50/95 border border-yellow-200 border-l-yellow-400'
                    : 'bg-red-500/20 border border-red-400/50 border-l-red-400'
                }`}>
                  <p className={`text-sm font-medium ${
                    messageTone === 'info' ? 'text-yellow-800' : 'text-red-100'
                  }`}>{error}</p>
                </div>
              </div>
            )}

            {formData.loginType === 'staff' && (
              <div className="mb-6 rounded-xl border border-amber-300/50 bg-amber-100/15 backdrop-blur-sm p-3 sm:p-4">
                <p className="text-[11px] sm:text-xs font-bold text-amber-100 uppercase tracking-wider">Current Access Window</p>
                <p className="text-xs sm:text-sm text-amber-50 mt-1">
                  {accessPolicy.enforceForStaffHod
                    ? `Staff and HOD login is allowed between ${getAccessWindowLabel()} (IST).`
                    : 'Staff and HOD time restriction is currently disabled by admin.'}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => switchLoginType('staff')}
                  className={`w-full py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all ${formData.loginType === 'staff' ? 'bg-white text-blue-700 border-white' : 'bg-white/10 text-white border-white/30'}`}
                >
                  Staff / HOD
                </button>
                <button
                  type="button"
                  onClick={() => switchLoginType('student')}
                  className={`w-full py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-bold transition-all ${formData.loginType === 'student' ? 'bg-white text-blue-700 border-white' : 'bg-white/10 text-white border-white/30'}`}
                >
                  Student
                </button>
              </div>

              {formData.loginType === 'staff' && (
                <div>
                  <label className="block text-sm font-bold text-white mb-3">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      autoComplete="username"
                      pattern=".*@msec\.edu\.in$"
                      title="Please use your MSEC email address (@msec.edu.in)"
                      className="w-full pl-4 pr-10 md:pr-14 py-3 sm:py-4 border-0 rounded-xl sm:rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200"
                      placeholder="Enter your MSEC email address"
                      required={formData.loginType === 'staff'}
                    />

                    <div className="absolute inset-y-0 right-1 md:right-2 flex items-center">
                      <button
                        type="button"
                        onClick={sendLoginVerificationCode}
                        disabled={isSendingLoginCode || !formData.email || isStaffEmailVerified}
                        className="mail-send-btn h-6 w-6 md:h-9 md:w-9 rounded-xl border border-emerald-200/35 text-white flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isStaffEmailVerified ? 'Email verified' : (isSendingLoginCode ? 'Sending OTP...' : (isLoginCodeSent ? 'Resend OTP' : 'Send OTP'))}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 2L11 13" />
                          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-emerald-100/95">
                    {isStaffEmailVerified ? 'Email verified. Continue with password.' : (isLoginCodeSent ? 'OTP sent. Enter 6-digit code below.' : 'Click send icon to receive OTP.')}
                  </p>

                  {!isStaffEmailVerified && isLoginCodeSent && (
                    <div className="mt-3 rounded-xl border border-emerald-300/45 bg-emerald-100/15 p-3">
                      <label className="block text-[11px] uppercase tracking-wider font-bold text-emerald-100 mb-2">Enter OTP</label>
                      <input
                        type="text"
                        value={loginCode}
                        onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-3 py-2.5 border-0 rounded-lg backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-emerald-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200 tracking-[0.35em] text-center"
                        placeholder="------"
                        inputMode="numeric"
                        maxLength={6}
                      />
                      <p className="mt-2 text-xs leading-relaxed text-emerald-100">
                        {isVerifyingLoginCode ? 'Verifying OTP...' : 'OTP auto-verifies after entering 6 digits.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {formData.loginType === 'student' && (
                <div>
                  <label className="block text-sm font-bold text-white mb-3">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    name="regNumber"
                    value={formData.regNumber}
                    onChange={handleInputChange}
                    autoComplete="username"
                    autoCapitalize="characters"
                    className="w-full px-4 py-3 sm:py-4 border-0 rounded-xl sm:rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200"
                    placeholder="Enter your registration number"
                    required={formData.loginType === 'student'}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-white mb-3">
                  Password
                </label>
                <input
                  type="password"
                  name={formData.loginType === 'student' ? 'passwordStudent' : 'passwordStaff'}
                  value={formData.password}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, password: e.target.value }))
                    if (error) setError('')
                  }}
                  autoComplete={formData.loginType === 'student' ? 'current-password' : 'current-password'}
                  className="w-full px-4 py-3 sm:py-4 border-0 rounded-xl sm:rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading || !!accessBlocked || (formData.loginType === 'staff' && !isStaffEmailVerified)}
                  className="glass-button w-full py-3.5 sm:py-4 px-6 text-blue-600 text-base sm:text-lg font-bold rounded-xl sm:rounded-2xl transition-all duration-300 md:hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">
                    {isLoading ? 'Signing in...' : accessBlocked ? 'Access Restricted' : 'Sign In'}
                  </span>
                </button>
              </div>
            </form>

            {formData.loginType === 'staff' && (
              <div className="mt-8 text-center">
                <p className="text-gray-100 text-sm">
                  Don't have an account?
                  <span className="text-blue-600 font-semibold cursor-pointer hover:underline ml-1" onClick={() => navigate('/signup')}>
                    Sign up
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
