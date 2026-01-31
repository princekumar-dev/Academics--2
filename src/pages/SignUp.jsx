import { useState } from 'react'
import apiClient from '../utils/apiClient'
import { getUserFriendlyMessage } from '../utils/apiErrorMessages'
import { useNavigate } from 'react-router-dom'

const SINGLE_SECTION_DEPARTMENTS = ['MECH', 'CIVIL', 'EEE']

function SignUp() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    department: '',
    year: '',
    section: '',
    phoneNumber: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'department') {
        if (SINGLE_SECTION_DEPARTMENTS.includes(value)) {
          updated.section = 'A'
        } else if (SINGLE_SECTION_DEPARTMENTS.includes(prev.department) && !SINGLE_SECTION_DEPARTMENTS.includes(value)) {
          updated.section = ''
        }
      }
      return updated
    })
    if (error) setError('')
    if (success) setSuccess('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Basic validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword || !formData.role || !formData.department) {
      const missingFields = []
      if (!formData.name) missingFields.push('Full Name')
      if (!formData.email) missingFields.push('Email')
      if (!formData.password) missingFields.push('Password')
      if (!formData.confirmPassword) missingFields.push('Confirm Password')
      if (!formData.role) missingFields.push('Role')
      if (!formData.department) missingFields.push('Department')
      setError(`Missing required fields: ${missingFields.join(', ')}. Please fill in all fields to continue.`)
      setIsLoading(false)
      return
    }
    
    // Validate email domain
    const emailDomain = formData.email.toLowerCase().split('@')[1]
    if (emailDomain !== 'msec.edu.in') {
      setError('❌ Invalid email domain. Only MSEC institutional emails are allowed. Example: john.doe@msec.edu.in')
      setIsLoading(false)
      return
    }
    
    if (formData.role === 'staff' && (!formData.year || !formData.section)) {
      setError('📋 Staff members must specify: ' + (!formData.year ? 'Academic Year (I-IV)' : '') + (!formData.year && !formData.section ? ' and ' : '') + (!formData.section ? 'Section (A/B)' : ''))
      setIsLoading(false)
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('🔒 Password mismatch. The passwords you entered don\'t match. Please verify and try again.')
      setIsLoading(false)
      return
    }
    if (formData.password.length < 6) {
      setError('🔒 Password too weak. Please use at least 6 characters for security.')
      setIsLoading(false)
      return
    }

    try {
      // Create user via API
      const userData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        department: formData.department,
        phoneNumber: formData.phoneNumber
      }
      
      // Add year and section for staff role
      if (formData.role === 'staff') {
        userData.year = formData.year
        userData.section = formData.section
      }
      
      try {
        const data = await apiClient.post('/api/users', userData)
        if (!data || !data.success) {
          setError(data?.error || '❌ Failed to create account. Please check your information and try again.')
          return
        }
      } catch (err) {
        if (err && err.status === 409) {
          setError('📧 This email is already registered. Try logging in instead, or use a different email.')
        } else {
          setError(getUserFriendlyMessage(err, 'Unable to create account. Please check your information and try again.'))
        }
        return
      }

      // On success, show different message based on role
      if (formData.role === 'staff') {
        setSuccess('📋 Account request submitted! Waiting for HOD approval...')
        setTimeout(() => navigate('/login'), 2000)
      } else {
        setSuccess('✅ Account created successfully! Redirecting to sign in...')
        setTimeout(() => navigate('/login'), 900)
      }
    } catch (err) {
      setError(getUserFriendlyMessage(err, 'Unable to create account. Please verify all information and try again.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 smooth-scroll mobile-smoothest-scroll no-mobile-anim">
      <style>{`
        @keyframes waveButtonAnimation {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .login-wave-button {
          background: linear-gradient(90deg, var(--theme-gold-600), var(--theme-gold-300), var(--theme-gold-600), var(--theme-gold-300));
          background-size: 300% 100%;
          animation: waveButtonAnimation 3s ease-in-out infinite;
          transition: all 0.3s ease;
        }
        .login-wave-button:hover { animation-duration: 1.5s; }
      `}</style>

      <div className="relative z-10">
        <div className="w-full max-w-md">
          <div className="backdrop-blur-md bg-white/20 border border-white/30 p-8 rounded-3xl shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Create Account</h1>
              <p className="text-gray-100 text-lg">Sign up for your MSEC Academics account</p>
            </div>

            {error && (
              <div className="mb-6">
                <div className="backdrop-blur-sm bg-red-500/20 border border-red-400/50 p-4 border-l-4 rounded-lg">
                  <p className="text-red-100 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-6">
                <div className="backdrop-blur-sm bg-green-500/20 border border-green-400/50 p-4 border-l-4 rounded-lg">
                  <p className="text-green-100 text-sm font-medium">{success}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-white mb-3">Full Name</label>
                <input name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200" placeholder="Enter your name" required />
              </div>

              <div>
                <label className="block text-sm font-bold text-white mb-3">Email Address</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  pattern=".*@msec\.edu\.in$"
                  title="Please use your MSEC email address (@msec.edu.in)"
                  className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200" 
                  placeholder="Enter your email" 
                  required 
                />
                <p className="mt-2 text-xs text-gray-100">Use your official MSEC email address</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-white mb-3">Role</label>
                <select name="role" value={formData.role} onChange={handleInputChange} className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white" required>
                  <option value="" className="bg-gray-800">Select Role</option>
                  <option value="staff" className="bg-gray-800">Staff</option>
                  <option value="hod" className="bg-gray-800">HOD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-white mb-3">Department</label>
                <select name="department" value={formData.department} onChange={handleInputChange} className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white" required>
                  <option value="" className="bg-gray-800">Select Department</option>
                  <option value="CSE" className="bg-gray-800">Computer Science & Engineering</option>
                  <option value="AI_DS" className="bg-gray-800">Artificial Intelligence & Datascience</option>
                  <option value="ECE" className="bg-gray-800">Electronics & Communication Engineering</option>
                  <option value="IT" className="bg-gray-800">Information Technology</option>
                  <option value="HNS" className="bg-gray-800">Humanities & Science (H&S)</option>
                  <option value="MECH" className="bg-gray-800">Mechanical Engineering</option>
                  <option value="CIVIL" className="bg-gray-800">Civil Engineering</option>
                  <option value="EEE" className="bg-gray-800">Electrical & Electronics Engineering</option>
                </select>
              </div>

              {formData.role === 'staff' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-white mb-3">Year</label>
                    <select name="year" value={formData.year || ''} onChange={handleInputChange} className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white" required>
                      <option value="" className="bg-gray-800">Select Year</option>
                      <option value="I" className="bg-gray-800">I</option>
                      <option value="II" className="bg-gray-800">II</option>
                      <option value="III" className="bg-gray-800">III</option>
                      <option value="IV" className="bg-gray-800">IV</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-white mb-3">Section</label>
                    <select
                      name="section"
                      value={formData.section || ''}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white ${SINGLE_SECTION_DEPARTMENTS.includes(formData.department) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      required
                      disabled={SINGLE_SECTION_DEPARTMENTS.includes(formData.department)}
                    >
                      <option value="" className="bg-gray-800">Select Section</option>
                      <option value="A" className="bg-gray-800">A</option>
                      {!SINGLE_SECTION_DEPARTMENTS.includes(formData.department) && <option value="B" className="bg-gray-800">B</option>}
                    </select>
                    {SINGLE_SECTION_DEPARTMENTS.includes(formData.department) && (
                      <p className="mt-1 text-xs text-gray-100">{formData.department} has a single Section A by default.</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-white mb-3">Phone Number</label>
                <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200" placeholder="Enter your number" />
              </div>

              <div>
                <label className="block text-sm font-bold text-white mb-3">Password</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200" placeholder="Create a password" required />
              </div>

              <div>
                <label className="block text-sm font-bold text-white mb-3">Confirm Password</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className="w-full px-4 py-4 border-0 rounded-2xl backdrop-blur-sm bg-white/20 border border-white/30 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-all duration-200 text-white placeholder:text-gray-200" placeholder="Repeat password" required />
              </div>

              <div className="pt-4">
                <button type="submit" disabled={isLoading} className="glass-button w-full py-4 px-6 text-blue-600 text-lg font-bold rounded-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="truncate">{isLoading ? 'Creating account...' : 'Create Account'}</span>
                </button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-100 text-sm">Already have an account? <span className="text-blue-600 font-semibold cursor-pointer hover:underline ml-1" onClick={() => navigate('/login')}>Sign in</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignUp
