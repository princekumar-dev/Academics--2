
import { useState, useEffect } from 'react'
import apiClient from '../utils/apiClient'
import { Link } from 'react-router-dom'
import ResponsiveImage from '../components/ResponsiveImage'

function Home() {
  const [userData, setUserData] = useState(null)
  const [dashboardStats, setDashboardStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let authData = null
    try {
      const auth = localStorage.getItem('auth')
      if (auth) authData = JSON.parse(auth)
    } catch {
      // Corrupted auth - clear and rely on App route guard to redirect
      localStorage.removeItem('auth')
      localStorage.removeItem('isLoggedIn')
      localStorage.removeItem('userEmail')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userId')
      return
    }
    // Fallback to legacy auth keys if present
    if (!authData || typeof authData !== 'object') {
      const loggedIn = localStorage.getItem('isLoggedIn') === 'true'
      const role = localStorage.getItem('userRole')
      const email = localStorage.getItem('userEmail')
      const userId = localStorage.getItem('userId')
      if (loggedIn && role && (role === 'staff' || role === 'hod')) {
        authData = { isAuthenticated: true, email, role, id: userId, section: '', year: '', department: '' }
      } else {
        return
      }
    }
    if (!authData.role || (authData.role !== 'staff' && authData.role !== 'hod')) {
      return
    }
    // If section is missing, fetch latest user data from backend
    if (!authData.section || authData.section === undefined) {
      apiClient.get(`/api/users?id=${authData.id}`)
        .then(data => {
          if (data?.success && data.user) {
            const updatedAuth = { ...authData, section: data.user.section, year: data.user.year, department: data.user.department }
            localStorage.setItem('auth', JSON.stringify(updatedAuth))
            setUserData(updatedAuth)
            fetchDashboardData(updatedAuth)
          } else {
            setUserData(authData)
            fetchDashboardData(authData)
          }
        })
        .catch(() => {
          setUserData(authData)
          fetchDashboardData(authData)
        })
    } else {
      setUserData(authData)
      fetchDashboardData(authData)
    }
  }, [])

  const fetchDashboardData = async (user) => {
    try {
      setIsLoading(true)
      let response, data;
      if (user.role === 'staff') {
        const staffId = user._id || user.id || localStorage.getItem('userId');
        data = await apiClient.get(`/api/marksheets?staffId=${staffId}`);
        if (data.success) {
          const normalizedMarksheets = (data.marksheets || []).map(m => m.status === 'rescheduled_by_hod'
            ? { ...m, status: 'dispatch_requested', dispatchRequest: { ...(m.dispatchRequest || {}), hodResponse: null } }
            : m)
          const verified = normalizedMarksheets.filter(m => 
            m.status === 'verified_by_staff' || 
            m.status === 'dispatch_requested' || 
            m.status === 'approved_by_hod' || 
            m.status === 'dispatched'
          ).length;
          const dispatchRequested = normalizedMarksheets.filter(m => m.status === 'dispatch_requested').length;
          const dispatched = normalizedMarksheets.filter(m => m.status === 'dispatched').length;
          // Sort marksheets by register number in ascending order
          const sortedMarksheets = [...normalizedMarksheets].sort((a, b) => {
            const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
            const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
            return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
          })
          
          const stats = {
            totalMarksheets: normalizedMarksheets.length,
            verified,
            dispatchRequested,
            dispatched,
            recentMarksheets: sortedMarksheets.slice(0, 5)
          };
          setDashboardStats(stats);
        }
      } else if (user.role === 'hod') {
        // For HNS HOD, show Year I marksheets across all departments so dashboard reflects first-year activity
        if (user.department === 'HNS') {
          data = await apiClient.get(`/api/marksheets?year=I`);
        } else {
          data = await apiClient.get(`/api/marksheets?hodId=${user.id}`);
        }
        if (data.success) {
          const normalizedMarksheets = (data.marksheets || []).map(m => m.status === 'rescheduled_by_hod'
            ? { ...m, status: 'dispatch_requested', dispatchRequest: { ...(m.dispatchRequest || {}), hodResponse: null } }
            : m)
          const pending = normalizedMarksheets.filter(m => m.status === 'dispatch_requested').length;
          const approved = normalizedMarksheets.filter(m => m.status === 'approved_by_hod').length;
          const dispatched = normalizedMarksheets.filter(m => m.status === 'dispatched').length;
          // Sort marksheets by register number in ascending order
          const sortedMarksheets = [...normalizedMarksheets].sort((a, b) => {
            const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
            const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
            return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
          })
          
          const stats = {
            totalMarksheets: normalizedMarksheets.length,
            pendingApproval: pending,
            approved,
            dispatched,
            recentRequests: sortedMarksheets.filter(m => ['dispatch_requested', 'approved_by_hod', 'dispatched'].includes(m.status)).slice(0, 5)
          };
          setDashboardStats(stats);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
        <ResponsiveImage src="/images/mseclogo.png" alt="MSEC Logo" className="mx-auto mb-4 w-16 h-16" sizes="64px" widths={[64,128]} lazy={true} />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">MSEC <span className="text-yellow-600">Academics</span></h1>
        <p className="text-gray-700 mb-6">The future of academic management is here.<br/>Experience seamless, intelligent, and interactive marksheet and report management.</p>
        <div className="flex justify-center gap-4 mb-6">
          <a href="https://twitter.com/" target="_blank" rel="noopener noreferrer" className="bg-yellow-100 p-3 rounded-xl"><svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 01-3.14 1.53A4.48 4.48 0 0022.4.36a9.09 9.09 0 01-2.88 1.1A4.52 4.52 0 0016.11 0c-2.5 0-4.52 2.02-4.52 4.52 0 .35.04.7.11 1.03A12.94 12.94 0 013 1.64a4.52 4.52 0 001.4 6.04A4.48 4.48 0 012.8 7.1v.06c0 2.18 1.55 4 3.8 4.42a4.52 4.52 0 01-2.04.08c.58 1.81 2.26 3.13 4.25 3.16A9.05 9.05 0 010 21.54a12.8 12.8 0 006.92 2.03c8.3 0 12.84-6.88 12.84-12.84 0-.2 0-.39-.01-.58A9.22 9.22 0 0023 3z"/></svg></a>
          <a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer" className="bg-yellow-700 p-3 rounded-xl"><svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.25c-.97 0-1.75-.78-1.75-1.75s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.75-1.75 1.75zm13.5 11.25h-3v-5.5c0-1.32-.03-3-1.83-3-1.83 0-2.11 1.43-2.11 2.91v5.59h-3v-10h2.88v1.36h.04c.4-.75 1.38-1.54 2.84-1.54 3.04 0 3.6 2 3.6 4.59v5.59z"/></svg></a>
          <a href="https://instagram.com/" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-tr from-pink-500 to-yellow-500 p-3 rounded-xl"><svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.584.012 4.85.07 1.17.056 1.97.24 2.43.41a4.92 4.92 0 011.77 1.77c.17.46.354 1.26.41 2.43.058 1.266.07 1.65.07 4.85s-.012 3.584-.07 4.85c-.056 1.17-.24 1.97-.41 2.43a4.92 4.92 0 01-1.77 1.77c-.46.17-1.26.354-2.43.41-1.266.058-1.65.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.056-1.97-.24-2.43-.41a4.92 4.92 0 01-1.77-1.77c-.17-.46-.354-1.26-.41-2.43C2.212 15.784 2.2 15.4 2.2 12s.012-3.584.07-4.85c.056-1.17.24-1.97.41-2.43A4.92 4.92 0 014.45 2.95c.46-.17 1.26-.354 2.43-.41C8.416 2.212 8.8 2.2 12 2.2zm0-2.2C8.736 0 8.332.012 7.052.07c-1.276.058-2.15.24-2.91.51a6.92 6.92 0 00-2.51 1.64A6.92 6.92 0 00.58 4.142c-.27.76-.452 1.634-.51 2.91C.012 8.332 0 8.736 0 12c0 3.264.012 3.668.07 4.948.058 1.276.24 2.15.51 2.91a6.92 6.92 0 001.64 2.51 6.92 6.92 0 002.51 1.64c.76.27 1.634.452 2.91.51C8.332 23.988 8.736 24 12 24c3.264 0 3.668-.012 4.948-.07 1.276-.058 2.15-.24 2.91-.51a6.92 6.92 0 002.51-1.64 6.92 6.92 0 001.64-2.51c.27-.76.452-1.634.51-2.91.058-1.28.07-1.684.07-4.948 0-3.264-.012-3.668-.07-4.948-.058-1.276-.24-2.15-.51-2.91a6.92 6.92 0 00-1.64-2.51A6.92 6.92 0 0019.858.58c-.76-.27-1.634-.452-2.91-.51C15.668.012 15.264 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a3.999 3.999 0 110-7.998 3.999 3.999 0 010 7.998zm6.406-11.845a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z"/></svg></a>
        </div>
        <Link to="/login" className="glass-button px-6 py-3 text-blue-600 rounded-xl font-bold">
          Login
        </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 no-mobile-anim">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Welcome Header */}
          <div className="mb-8">
            <div className="glass-card no-mobile-backdrop p-6 rounded-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">
                    Welcome back, {userData.name}
                  </h1>
                  <p className="text-lg text-gray-600">
                    {userData.role === 'staff' ? 
                      (() => {
                        // Map year to Roman numerals
                        const romanMap = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', 'I': 'I', 'II': 'II', 'III': 'III', 'IV': 'IV' };
                        const yearRoman = romanMap[(userData.year || '').toString().trim()] || userData.year || 'N/A';
                          const section = userData.section && userData.section.trim() ? userData.section : 'N/A';
                        return `${userData.department} Department  ${yearRoman}-${section}`;
                      })() : 
                      `Head of ${userData.department} Department`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">
                    {new Date().toLocaleDateString('en-IN', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Staff Dashboard */}
          {userData.role === 'staff' && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="glass-card no-mobile-backdrop p-6 rounded-2xl">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-blue-100">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Marksheets</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats?.totalMarksheets || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="glass-card no-mobile-backdrop p-6 rounded-2xl">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-green-100">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Verified</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats?.verified || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="glass-card no-mobile-backdrop p-6 rounded-2xl">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-yellow-100">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Dispatch Requested</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats?.dispatchRequested || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="glass-card no-mobile-backdrop p-6 rounded-2xl">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-purple-100">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Dispatched</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats?.dispatched || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Link to="/marksheets" className="glass-card no-mobile-backdrop group p-6 rounded-2xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="text-center">
                    <div className="p-4 rounded-full bg-amber-100 inline-block mb-4 group-hover:bg-amber-200 transition-colors">
                      <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Generate Marksheet</h3>
                    <p className="text-gray-600">Create and manage student marksheets</p>
                  </div>
                </Link>

                <Link to="/marksheets" className="glass-card no-mobile-backdrop group p-6 rounded-2xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="text-center">
                    <div className="p-4 rounded-full bg-green-100 inline-block mb-4 group-hover:bg-green-200 transition-colors">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">View Marksheets</h3>
                    <p className="text-gray-600">Manage and verify generated marksheets</p>
                  </div>
                </Link>

                <Link to="/dispatch-requests" className="glass-card no-mobile-backdrop group p-6 rounded-2xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="text-center">
                    <div className="p-4 rounded-full bg-purple-100 inline-block mb-4 group-hover:bg-purple-200 transition-colors">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Dispatch Requests</h3>
                    <p className="text-gray-600">Submit requests to dispatch marksheets</p>
                  </div>
                </Link>
              </div>
            </>
          )}

          {/* HOD Dashboard */}
          {userData.role === 'hod' && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="glass-card no-mobile-backdrop p-6 rounded-2xl">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-blue-100">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Marksheets</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats?.totalMarksheets || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="glass-card no-mobile-backdrop p-6 rounded-2xl">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-red-100">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending Approval</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats?.pendingApproval || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="glass-card no-mobile-backdrop p-6 rounded-2xl">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-green-100">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Approved</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats?.approved || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="glass-card no-mobile-backdrop p-6 rounded-2xl">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-purple-100">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Dispatched</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboardStats?.dispatched || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Link to="/approval-requests" className="glass-card no-mobile-backdrop group p-6 rounded-2xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="text-center">
                    <div className="p-4 rounded-full bg-red-100 inline-block mb-4 group-hover:bg-red-200 transition-colors">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Approval Requests</h3>
                    <p className="text-gray-600">Review and approve dispatch requests</p>
                  </div>
                </Link>

                <Link to="/department-overview" className="glass-card no-mobile-backdrop group p-6 rounded-2xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="text-center">
                    <div className="p-4 rounded-full bg-blue-100 inline-block mb-4 group-hover:bg-blue-200 transition-colors">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Department Overview</h3>
                    <p className="text-gray-600">View all department marksheets and stats</p>
                  </div>
                </Link>

                <Link to="/reports" className="glass-card no-mobile-backdrop group p-6 rounded-2xl hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="text-center">
                    <div className="p-4 rounded-full bg-green-100 inline-block mb-4 group-hover:bg-green-200 transition-colors">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Reports</h3>
                    <p className="text-gray-600">Generate and export department reports</p>
                  </div>
                </Link>
              </div>
            </>
          )}

          {/* Recent Activity */}
          <div className="glass-card no-mobile-backdrop p-6 rounded-3xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h2>
            {dashboardStats?.recentMarksheets?.length > 0 || dashboardStats?.recentRequests?.length > 0 ? (
              <div className="space-y-4">
                {(userData?.role === 'hod' ? dashboardStats?.recentRequests : dashboardStats?.recentMarksheets || []).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">{item.studentDetails?.name}</p>
                      <p className="text-sm text-gray-600">
                        {item.studentDetails?.year}-{item.studentDetails?.section} • {item.studentDetails?.regNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'verified_by_staff' ? 'bg-green-100 text-green-800' :
                        (item.status === 'dispatch_requested' || item.status === 'rescheduled_by_hod') ? 'bg-yellow-100 text-yellow-800' :
                        item.status === 'approved_by_hod' ? 'bg-blue-100 text-blue-800' :
                        item.status === 'rejected_by_hod' ? 'bg-red-100 text-red-800' :
                        item.status === 'dispatched' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {(item.status || 'unknown').replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home