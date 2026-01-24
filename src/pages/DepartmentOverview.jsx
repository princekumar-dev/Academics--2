import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../utils/apiClient'

function DepartmentOverview() {
  const navigate = useNavigate()
  const [userData, setUserData] = useState(() => {
    const auth = localStorage.getItem('auth')
    return auth ? JSON.parse(auth) : null
  })
  const [departmentStats, setDepartmentStats] = useState(null)
  const [recentActivity, setRecentActivity] = useState([])
  const [staffPerformance, setStaffPerformance] = useState([])
  const [departmentBreakdown, setDepartmentBreakdown] = useState([])
  const [loading, setLoading] = useState(true)
  // Department color classes for badges
  const departmentColors = {
    'CSE': 'bg-blue-100 text-blue-800',
    'AI_DS': 'bg-indigo-100 text-indigo-800',
    'ECE': 'bg-teal-100 text-teal-800',
    'IT': 'bg-green-100 text-green-800',
    'MECH': 'bg-amber-100 text-amber-800',
    'CIVIL': 'bg-red-100 text-red-800',
    'EEE': 'bg-purple-100 text-purple-800',
    'HNS': 'bg-yellow-50 text-yellow-800'
  }

  // Department card style map (used for department-wise distribution cards)
  const departmentCardStyles = {
    'CSE': { cardBg: 'bg-gradient-to-br from-blue-50 to-blue-100', border: 'border-blue-200', title: 'text-blue-600', value: 'text-blue-700', accent: 'text-blue-400' },
    'AI_DS': { cardBg: 'bg-gradient-to-br from-indigo-50 to-indigo-100', border: 'border-indigo-200', title: 'text-indigo-600', value: 'text-indigo-700', accent: 'text-indigo-400' },
    'ECE': { cardBg: 'bg-gradient-to-br from-teal-50 to-teal-100', border: 'border-teal-200', title: 'text-teal-600', value: 'text-teal-700', accent: 'text-teal-400' },
    'IT': { cardBg: 'bg-gradient-to-br from-green-50 to-green-100', border: 'border-green-200', title: 'text-green-600', value: 'text-green-700', accent: 'text-green-400' },
    'MECH': { cardBg: 'bg-gradient-to-br from-amber-50 to-amber-100', border: 'border-amber-200', title: 'text-amber-700', value: 'text-amber-800', accent: 'text-amber-600' },
    'CIVIL': { cardBg: 'bg-gradient-to-br from-red-50 to-red-100', border: 'border-red-200', title: 'text-red-600', value: 'text-red-700', accent: 'text-red-400' },
    'EEE': { cardBg: 'bg-gradient-to-br from-purple-50 to-purple-100', border: 'border-purple-200', title: 'text-purple-600', value: 'text-purple-700', accent: 'text-purple-400' },
    'HNS': { cardBg: 'bg-gradient-to-br from-yellow-50 to-yellow-100', border: 'border-yellow-200', title: 'text-yellow-700', value: 'text-yellow-800', accent: 'text-yellow-600' }
  }

  useEffect(() => {
    if (userData && userData.role === 'hod') {
      fetchDepartmentData()
    }
  }, [userData])

  const fetchDepartmentData = async () => {
    try {
      // For HNS HOD, fetch Year I marksheets across all departments
      const marksheetsUrl = userData.department === 'HNS'
        ? `/api/marksheets?year=I&includeAll=true`
        : `/api/marksheets?department=${userData.department}&includeAll=true`

      // Fetch marksheets and users in parallel via apiClient
      const [marksheetsData, usersData] = await Promise.all([
        apiClient.get(marksheetsUrl),
        apiClient.get('/api/users')
      ])
      
      if (marksheetsData.success) {
        const marksheets = marksheetsData.marksheets
        const users = usersData.success ? usersData.users : []
        
        // Create a map of userId to user data
        // API returns _id as id, so we need to handle both formats
        const userMap = {}
        users.forEach(user => {
          // Store by the id field (which is actually _id from MongoDB)
          if (user.id) {
            userMap[user.id] = user
            userMap[user.id.toString()] = user
          }
          // Also store by _id if it exists
          if (user._id) {
            userMap[user._id] = user
            userMap[user._id.toString()] = user
          }
        })
        
        // Debug: Log data to understand the structure
        console.log('=== Department Overview Debug ===')
        console.log('Total marksheets:', marksheets.length)
        console.log('Total users fetched:', users.length)
        
        if (marksheets.length > 0) {
          console.log('Sample marksheet:', {
            staffId: marksheets[0].staffId,
            staffName: marksheets[0].staffName
          })
        }
        
        if (users.length > 0) {
          console.log('All users:', users.map(u => ({
            id: u.id,
            name: u.name,
            role: u.role,
            year: u.year,
            section: u.section,
            department: u.department
          })))
        }
        
        console.log('UserMap keys:', Object.keys(userMap))
        console.log('=== End Debug ===')

        
        // Calculate comprehensive stats (overall)
        const totalMarksheets = marksheets.length
        const totalStudents = new Set(marksheets.map(m => m.studentDetails?.regNumber)).size
        const byStatus = {
          draft: marksheets.filter(m => m.status === 'draft').length,
          verified: marksheets.filter(m => m.status === 'verified_by_staff').length,
          pending: marksheets.filter(m => m.status === 'dispatch_requested').length,
          approved: marksheets.filter(m => m.status === 'approved_by_hod').length,
          rejected: marksheets.filter(m => m.status === 'rejected_by_hod').length,
          dispatched: marksheets.filter(m => m.status === 'dispatched').length,
        }
        const completionRate = totalMarksheets > 0 ? Math.round((byStatus.dispatched / totalMarksheets) * 100) : 0
        const pendingActions = byStatus.pending
        const stats = { totalMarksheets, totalStudents, byClass: {}, byStatus, completionRate, pendingActions }
        
        // Group by year
        marksheets.forEach(m => {
          const yearKey = m.studentDetails?.year || 'Unknown'
          if (!stats.byClass[yearKey]) {
            stats.byClass[yearKey] = 0
          }
          stats.byClass[yearKey]++
        })
        
        // Get recent activity (last 10 updates)
        const recent = marksheets
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          .slice(0, 10)
          .map(m => ({
            id: m._id,
            student: m.studentDetails?.name || 'Unknown',
            regNumber: m.studentDetails?.regNumber || 'N/A',
            status: m.status,
            updatedAt: m.updatedAt,
            examination: m.examination?.name || 'N/A'
          }))
        
        // Calculate staff performance
        const staffStats = {}
        // If HNS, also compute department-wise breakdown
        const deptMap = {}
        marksheets.forEach(m => {
          // Get staffId and convert to string if it's an ObjectId
          const staffId = (m.staffId || m.createdBy || m.userId || 'Unknown').toString()
          const dept = m.studentDetails?.department || 'Unknown'

          if (!deptMap[dept]) {
            deptMap[dept] = { total: 0, dispatched: 0, pending: 0, uniqueStudents: new Set(), topStaff: {} }
          }
          deptMap[dept].total++
          if (m.status === 'dispatched') deptMap[dept].dispatched++
          if (m.status === 'dispatch_requested') deptMap[dept].pending++
          if (m.studentDetails?.regNumber) deptMap[dept].uniqueStudents.add(m.studentDetails.regNumber)
          
          if (!staffStats[staffId]) {
            const staffUser = userMap[staffId]
            
            // If staff user not found, try using the staffName from marksheet
            const staffName = staffUser?.name || m.staffName || 'Unknown Staff'
            // Get year and section from the marksheet (student details), not from staff user
            const year = m.studentDetails?.year || null
            const section = m.studentDetails?.section || null
            
            // Debug: Log if staff not found
            if (!staffUser && staffId !== 'Unknown') {
              console.log('Staff not found for ID:', staffId)
              console.log('Using fallback staffName:', m.staffName)
            }
            
            staffStats[staffId] = {
              total: 0,
              verified: 0,
              dispatched: 0,
              staffName: staffName,
              year: year,
              section: section
            }
          }
          // Track staff contribution per department (for HNS overview)
          if (deptMap[dept]) {
            const staffEntry = deptMap[dept].topStaff[staffId] || { staffName: staffStats[staffId]?.staffName || m.staffName || 'Unknown', total: 0, dispatched: 0 }
            staffEntry.total++
            if (m.status === 'dispatched') staffEntry.dispatched++
            deptMap[dept].topStaff[staffId] = staffEntry
          }
          staffStats[staffId].total++
          if (m.status === 'verified_by_staff' || m.status === 'dispatch_requested' || m.status === 'approved_by_hod' || m.status === 'dispatched') {
            staffStats[staffId].verified++
          }
          if (m.status === 'dispatched') {
            staffStats[staffId].dispatched++
          }
        })
        
        const staffPerf = Object.entries(staffStats).map(([id, stats]) => {
          // Year is already in Roman numerals (I, II, III, IV)
          const year = stats.year?.toString().trim() || null
          const section = stats.section?.toString().trim() || null
          
          // Format class as "Year-Section" (e.g., "II-A")
          let className = 'N/A'
          if (year && section) {
            className = `${year}-${section}`
          } else if (year) {
            className = year
          } else if (section) {
            className = section
          }
          
          // Debug log for first staff
          if (Object.keys(staffStats).indexOf(id) === 0) {
            console.log('First staff stats:', {
              id,
              staffName: stats.staffName,
              year: stats.year,
              section: stats.section,
              className
            })
          }
          
          // Resolve department from the users map if available. Do NOT fall back to HNS (current HOD)
          let dept = null
          if (typeof userMap !== 'undefined' && userMap) {
            dept = userMap[id]?.department || userMap[id?.toString()]?.department || null
            if (!dept) {
              // try to find by matching id/_id fields in stored users
              const found = Object.values(userMap).find(u => u && (String(u.id) === String(id) || String(u._id) === String(id)))
              dept = found?.department || null
            }
          }
          // Fallback: infer department from marksheets authored by this staff
          if (!dept) {
            const foundMs = marksheets.find(m => {
              try {
                return String(m.staffId) === String(id) || String(m.staffId) === id
              } catch { return false }
            })
            dept = foundMs?.studentDetails?.department || null
          }
          return {
            staffId: id,
            staffName: stats.staffName,
            className: className,
            department: dept,
            total: stats.total,
            verified: stats.verified,
            dispatched: stats.dispatched,
            completionRate: stats.total > 0 ? Math.round((stats.dispatched / stats.total) * 100) : 0
          }
        }).sort((a, b) => b.completionRate - a.completionRate)
        
        // Prepare department breakdown array (only useful for HNS HOD; for others it's just current department)
        const deptBreakdownArr = Object.entries(deptMap).map(([deptCode, info]) => {
          // Find top staff for department
          const topStaffEntries = Object.entries(info.topStaff || {}).map(([sid, s]) => ({ staffId: sid, staffName: s.staffName, total: s.total, dispatched: s.dispatched }))
          topStaffEntries.sort((a, b) => b.total - a.total)
          return {
            department: deptCode,
            totalMarksheets: info.total,
            students: info.uniqueStudents.size,
            dispatched: info.dispatched,
            pending: info.pending,
            completionRate: info.total > 0 ? Math.round((info.dispatched / info.total) * 100) : 0,
            topStaff: topStaffEntries.slice(0, 3)
          }
        }).sort((a, b) => b.totalMarksheets - a.totalMarksheets)

        setDepartmentStats(stats)
        setRecentActivity(recent)
        setStaffPerformance(staffPerf)
        setDepartmentBreakdown(deptBreakdownArr)
      }
    } catch (error) {
      console.error('Error fetching department data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!userData || userData.role !== 'hod') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only HODs can view department overview.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 no-mobile-anim">
      <div className="responsive-container py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-6 md:mb-8">
            <div className="glass-card no-mobile-backdrop responsive-spacing rounded-3xl">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#111418] mb-2">
                    Department Overview
                  </h1>
                  <p className="text-base sm:text-lg text-gray-600">
                    Real-time overview for {userData.department} Department
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="glass-card px-3 py-2 rounded-xl">
                    <div className="text-xs text-gray-500">Students</div>
                    <div className="text-xl md:text-2xl font-bold text-theme-gold-600">{departmentStats?.totalStudents || 0}</div>
                  </div>
                  <div className="glass-card px-3 py-2 rounded-xl">
                    <div className="text-xs text-gray-500">Completion</div>
                    <div className="text-xl md:text-2xl font-bold text-green-600">{departmentStats?.completionRate || 0}%</div>
                  </div>
                  <div className="glass-card px-3 py-2 rounded-xl">
                    <div className="text-xs text-gray-500">Pending</div>
                    <div className="text-xl md:text-2xl font-bold text-yellow-600">{departmentStats?.pendingActions || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="glass-card no-mobile-backdrop responsive-spacing rounded-3xl mb-6 md:mb-8">
            {loading ? (
              <div className="text-center py-12">
                <div className="loading-spinner mx-auto mb-4"></div>
                <p className="responsive-text text-gray-600">Loading department data...</p>
              </div>
            ) : (
              <div className="space-y-6 md:space-y-8">
                {/* Department-wise Distribution */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-theme-gold-600 inline-flex" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginTop: '-2px'}}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                    </svg>
                    <h2 className="responsive-heading-2 text-gray-900">Department-wise Distribution</h2>
                  </div>
                  <div className="responsive-grid responsive-grid-2 md:grid-cols-4">
                    {(departmentBreakdown && departmentBreakdown.length > 0 ? departmentBreakdown : Object.entries(departmentStats?.byClass || {}).map(([k, v]) => ({ department: k, totalMarksheets: v }))).map((d) => {
                      const style = departmentCardStyles[d.department] || { cardBg: 'bg-gradient-to-br from-slate-50 to-slate-100', border: 'border-slate-200', title: 'text-slate-600', value: 'text-slate-700', accent: 'text-slate-400' }
                      return (
                        <div key={d.department} className={`responsive-card ${style.cardBg} border-2 ${style.border} hover:shadow-lg transition-all duration-300`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-xs md:text-sm font-medium mb-1 ${style.title}`}>{d.department}</p>
                              <p className={`text-2xl md:text-3xl font-bold ${style.value}`}>{d.totalMarksheets ?? d.count ?? d.total ?? 0}</p>
                            </div>
                            <div>
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${departmentColors[d.department] || 'bg-gray-100 text-gray-800'}`}>
                                {d.department}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                  {/* Department-wise Progress (removed per request) */}

                {/* Staff Performance */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-theme-gold-600 inline-flex" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginTop: '-2px'}}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h2 className="responsive-heading-2 text-gray-900">Staff Performance</h2>
                  </div>
                  <div className="responsive-grid responsive-grid-2 lg:grid-cols-3">
                    {staffPerformance.slice(0, 6).map((staff, index) => (
                      <div key={staff.staffId} className="responsive-card bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center">
                                    <span className="text-sm font-bold text-indigo-700">#{index + 1}</span>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <div className="text-sm font-bold text-indigo-900">{staff.staffName}</div>
                                      {staff.department && (
                                        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ${departmentColors[staff.department] || 'bg-gray-100 text-gray-800'} uppercase`}>
                                          {staff.department}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-indigo-600">{staff.className}</div>
                                  </div>
                                </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-indigo-700">{staff.completionRate}%</div>
                            <div className="text-xs text-indigo-600">Complete</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-lg font-bold text-indigo-900">{staff.total}</div>
                            <div className="text-xs text-indigo-600">Total</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-green-600">{staff.verified}</div>
                            <div className="text-xs text-indigo-600">Verified</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-purple-600">{staff.dispatched}</div>
                            <div className="text-xs text-indigo-600">Sent</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-theme-gold-600 inline-flex" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginTop: '-2px'}}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <h2 className="responsive-heading-2 text-gray-900">Quick Actions</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <button onClick={() => navigate('/approval-requests')} className="responsive-card group bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 hover:shadow-xl transition-all duration-300 text-left">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-3 bg-yellow-100 rounded-xl group-hover:bg-yellow-200 transition-colors">
                          <svg className="w-6 h-6 md:w-7 md:h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">{departmentStats?.byStatus.pending || 0}</span>
                      </div>
                      <h3 className="text-base md:text-lg font-bold text-yellow-900 mb-2">Pending Approvals</h3>
                      <p className="text-sm text-yellow-700">Review dispatch requests awaiting approval</p>
                    </button>
                    <button onClick={() => navigate('/reports')} className="responsive-card group bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 hover:shadow-xl transition-all duration-300 text-left">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                          <svg className="w-6 h-6 md:w-7 md:h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">Reports</span>
                      </div>
                      <h3 className="text-base md:text-lg font-bold text-green-900 mb-2">Export Reports</h3>
                      <p className="text-sm text-green-700">Generate comprehensive department analytics</p>
                    </button>
                    <button onClick={() => {
                      const url = (userData?.department === 'HNS') ? '/records?year=I&includeAll=true' : `/records?department=${encodeURIComponent(userData?.department || '')}`
                      navigate(url)
                    }} className="responsive-card group bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 hover:shadow-xl transition-all duration-300 text-left">
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                          <svg className="w-6 h-6 md:w-7 md:h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">All</span>
                      </div>
                      <h3 className="text-base md:text-lg font-bold text-blue-900 mb-2">View All Records</h3>
                      <p className="text-sm text-blue-700">Browse complete department marksheets</p>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DepartmentOverview
