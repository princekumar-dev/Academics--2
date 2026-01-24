import { useState } from 'react'
import apiClient from '../utils/apiClient'
import { useNavigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    regNumber: '',
    loginType: 'staff'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { showSuccess, showError } = useAlert()

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const isStudent = formData.loginType === 'student'

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
    }

    try {
      // Send authentication request to the backend API
      console.log('🔐 Login attempt:', { email: formData.email, loginType: formData.loginType })
      const data = await apiClient.post('/api/auth', formData)
      console.log('📡 Auth API Response Data:', data)
      console.log('📡 Auth API Response Data:', data)

      if (data.success) {
        console.log('✅ Authentication successful')
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
          loginTime: new Date().toISOString()
        }
        localStorage.setItem('auth', JSON.stringify(authData))
        console.log('💾 Auth saved to localStorage:', authData)

        // Also save individual items for backward compatibility
        localStorage.setItem('isLoggedIn', 'true')
        if (data.user.email) localStorage.setItem('userEmail', data.user.email)
        localStorage.setItem('userRole', data.user.role)
        localStorage.setItem('userId', data.user.id)

        // Show success alert with glassmorphism
        showSuccess('Welcome Back!', `Logged in as ${data.user.name}`)

        // Redirect to root page which will handle role-based routing
        console.log('🔄 Redirecting to home after 500ms...')
        setTimeout(() => {
          console.log('✈️ Navigating to / with auth:', JSON.stringify(JSON.parse(localStorage.getItem('auth')), null, 2))
          navigate('/', { replace: true })
          // Trigger a custom event to update header authentication state
          window.dispatchEvent(new Event('authStateChanged'))
        }, 500)
      } else {
        const errorMsg = data.error || '🔐 Invalid credentials. Please check your email and password, then try again.'
        setError(errorMsg)
        showError('Login Failed', errorMsg + ' Need help? Contact support@msec.edu.in')
      }
    } catch (error) {
      console.error('Login error:', error)
      // apiClient throws an Error with `.status` and `.data` when HTTP status !== 2xx
      const apiErrMsg = error && error.data && (error.data.error || error.data.message)
      if (apiErrMsg) {
        // If server returned a pending-approval message, show it verbatim
        setError(apiErrMsg)
        showError('Login Failed', apiErrMsg)
      } else {
        let errorMsg
        if (error.message?.includes('fetch') || error.message?.includes('network')) {
          errorMsg = '🌐 Connection failed. Check your internet connection and try again.'
        } else if (error.message?.includes('timeout')) {
          errorMsg = '⏱️ Request timed out. The server is slow to respond. Please try again.'
        } else if (error.message && error.message.startsWith('HTTP')) {
          // Generic HTTP error without parsed body
          errorMsg = '❌ Login failed: ' + error.message
        } else {
          errorMsg = '❌ Login failed: ' + (error.message || 'Unknown error. Please try again or contact support.')
        }
        setError(errorMsg)
        showError('Error', errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 smooth-scroll mobile-smoothest-scroll no-mobile-anim">
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
        `}
      </style>
      
      <div className="relative z-10">
        
        <div className="w-full max-w-md relative z-10">
          <div className="backdrop-blur-md bg-white/20 border border-white/30 p-8 rounded-3xl shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Welcome Back</h1>
              <p className="text-gray-100 text-lg">Sign in to your MSEC Academics account</p>
            </div>
              
            {/* Error Message */}
            {error && (
              <div className="mb-6">
                <div className="backdrop-blur-sm bg-red-500/20 border border-red-400/50 p-4 border-l-4 rounded-lg">
                  <p className="text-red-100 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, loginType: 'staff' }))}
                  className={`w-full py-3 rounded-2xl border text-sm font-bold transition-all ${formData.loginType === 'staff' ? 'bg-white text-blue-700 border-white' : 'bg-white/10 text-white border-white/30'}`}
                >
                  Staff / HOD
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, loginType: 'student' }))}
                  className={`w-full py-3 rounded-2xl border text-sm font-bold transition-all ${formData.loginType === 'student' ? 'bg-white text-blue-700 border-white' : 'bg-white/10 text-white border-white/30'}`}
                >
                  Student
                </button>
              </div>

              {formData.loginType === 'staff' && (
                <div>
                  <label className="block text-sm font-bold text-white mb-3">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    pattern=".*@msec\.edu\.in$"
                    title="Please use your MSEC email address (@msec.edu.in)"
                    className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200"
                    placeholder="Enter your MSEC email address"
                    required={formData.loginType === 'staff'}
                  />
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
                    className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200"
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
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="glass-button w-full py-4 px-6 text-blue-600 text-lg font-bold rounded-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="truncate">
                    {isLoading ? 'Signing in...' : 'Sign In'}
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