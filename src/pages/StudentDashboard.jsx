import { useEffect, useState } from 'react'
import apiClient from '../utils/apiClient'
import { Link } from 'react-router-dom'
import SwipeableCard from '../components/SwipeableCard'

function StudentDashboard() {
  const [student, setStudent] = useState(null)
  const [marksheets, setMarksheets] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const authRaw = localStorage.getItem('auth')
    if (!authRaw) return
    try {
      const auth = JSON.parse(authRaw)
      if (auth.role !== 'student') return
      // Fetch fresh student data from database to get current department
      fetchStudentData(auth)
      fetchMarksheets(auth)
    } catch (e) {
      console.error('Invalid auth data', e)
    }
    const handler = () => {
      try {
        const authRaw2 = localStorage.getItem('auth')
        if (!authRaw2) return
        const auth2 = JSON.parse(authRaw2)
        if (auth2.role !== 'student') return
        fetchMarksheets(auth2, true)
      } catch (e) {}
    }
    window.addEventListener('marksheetsUpdated', handler)
    window.addEventListener('notificationsUpdated', handler)
    return () => {
      window.removeEventListener('marksheetsUpdated', handler)
      window.removeEventListener('notificationsUpdated', handler)
    }
  }, [])

  const fetchStudentData = async (auth) => {
    try {
      const phoneParam = encodeURIComponent(auth.phoneNumber || auth.parentPhoneNumber)
      const regNumberParam = encodeURIComponent(auth.regNumber || '')
      const data = await apiClient.get(`/api/users?studentPhoneNumber=${phoneParam}&regNumber=${regNumberParam}`)
      if (data.success && data.user) {
        // Merge fetched data with auth (preserving auth fields)
        const updatedStudent = { ...auth, ...data.user, role: 'student' }
        setStudent(updatedStudent)
      } else {
        // Fallback to localStorage data if fetch fails
        setStudent(auth)
      }
    } catch (err) {
      console.error('Failed to fetch student data:', err)
      // Fallback to localStorage data
      setStudent(auth)
    }
  }

  const fetchMarksheets = async (auth, force = false) => {
    setIsLoading(true)
    try {
      const queryParams = new URLSearchParams()
      if (auth.id) queryParams.set('studentId', auth.id)
      if (auth.regNumber) queryParams.set('regNumber', auth.regNumber)
      if (auth.phoneNumber) queryParams.set('phoneNumber', auth.phoneNumber)
      const opts = force ? { cache: false, dedupe: false } : {}
      const data = await apiClient.get(`/api/marksheets?${queryParams.toString()}`, opts)
      if (data.success) {
        const dispatchedOnly = (data.marksheets || []).filter(ms => ms.status === 'dispatched')
        setMarksheets(dispatchedOnly)
      }
    } catch (err) {
      console.error('Failed to load student marksheets', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Student Info Card */}
        <div className="glass-card p-8 rounded-3xl mb-8 backdrop-blur-lg border border-white/20 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Student Dashboard</p>
              <h1 className="text-4xl font-bold text-gray-900 mt-2">{student?.name}</h1>
              <div className="mt-6 space-y-2">
                <p className="text-sm text-gray-600">Registration: <span className="font-semibold text-gray-900">{student?.regNumber}</span></p>
                <p className="text-sm text-gray-600">Department: <span className="font-semibold text-gray-900">{student?.department || 'AI_DS'}</span></p>
                <p className="text-sm text-gray-600">Year: <span className="font-semibold text-gray-900">{student?.year}</span> | Section: <span className="font-semibold text-gray-900">{student?.section}</span></p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact Information</p>
              <div className="mt-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Parent's Phone</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{student?.parentPhoneNumber || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Marksheets Section */}
        <div className="glass-card p-8 rounded-3xl backdrop-blur-lg border border-white/20 shadow-lg">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Your Marksheets</h2>
              <p className="text-sm text-gray-500 mt-1">Swipe left to download or view</p>
            </div>
            <Link to="/contact" className="text-blue-600 text-sm font-semibold hover:text-blue-700 transition-colors">Need help?</Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-gray-600 mt-3">Loading your marksheets...</p>
              </div>
            </div>
          ) : marksheets.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">No marksheets yet</p>
              <p className="text-gray-500 text-sm mt-1">Your marksheets will appear here once they are dispatched</p>
            </div>
          ) : (
            <div className="space-y-4">
              {marksheets.map(ms => {
                const swipeActions = [
                  {
                    label: 'Download',
                    icon: '📥',
                    onClick: () => {
                      window.open(`/api/generate-pdf?marksheetId=${ms._id}`, '_blank')
                    },
                    className: 'bg-blue-600'
                  }
                ]

                return (
                  <SwipeableCard key={ms._id} actions={swipeActions}>
                    <div className="bg-white">
                      <div className="p-6">
                        {/* Header with name and status */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 break-words">{ms.studentDetails?.examinationName || 'Examination'}</h3>
                            <p className="text-xs sm:text-sm text-gray-600">{ms.studentDetails?.regNumber} • {ms.studentDetails?.year}-{ms.studentDetails?.section}</p>
                          </div>
                          <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-semibold uppercase tracking-wide flex items-center gap-0.5 sm:gap-1 flex-shrink-0 whitespace-nowrap ${
                            ms.status === 'dispatched' ? 'bg-purple-100 text-purple-700' :
                            ms.status === 'approved_by_hod' ? 'bg-blue-100 text-blue-700' :
                            ms.status === 'dispatch_requested' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            📤 {(ms.status || 'unknown').replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 text-xs sm:text-sm">
                          <div>
                            <p className="text-gray-500 mb-1 font-medium">Department</p>
                            <p className="font-medium text-gray-900">{ms.studentDetails?.department || '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1 font-medium">Result</p>
                            <p className={`font-bold ${
                              ms.overallResult === 'Pass' ? 'text-green-600' :
                              ms.overallResult === 'Fail' ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              {ms.overallResult || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1 font-medium">Updated</p>
                            <p className="font-medium text-gray-900">{ms.updatedAt ? new Date(ms.updatedAt).toLocaleDateString('en-IN') : '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1 font-medium">Parent Phone</p>
                            <p className="font-medium text-gray-900 truncate">{ms.studentDetails?.parentPhoneNumber || '—'}</p>
                          </div>
                        </div>

                        {/* Desktop Action Buttons */}
                        <div className="hidden sm:flex gap-3 mt-4 justify-end">
                          <a
                            href={`/api/generate-pdf?marksheetId=${ms._id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm hover:bg-blue-200 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download PDF
                          </a>
                        </div>
                      </div>

                      {/* Mobile: Swipe instruction hint */}
                      <div className="sm:hidden p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-100">
                        <p className="text-xs text-center text-gray-600 flex items-center justify-center gap-2">
                          <span>👈</span>
                          <span className="font-medium">Swipe left to download</span>
                        </p>
                      </div>
                    </div>
                  </SwipeableCard>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard
