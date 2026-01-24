import { useEffect, useState, useMemo, useCallback, memo } from 'react'
import apiClient from '../utils/apiClient'
import { useNavigate } from 'react-router-dom'
import { deriveOverallResult } from '../utils/resultUtils'

function Records() {
  const navigate = useNavigate()
  const [userData] = useState(() => {
    const auth = localStorage.getItem('auth')
    return auth ? JSON.parse(auth) : null
  })
  const [marksheets, setMarksheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [departmentFilter, setDepartmentFilter] = useState('ALL')
  const [selectedExamination, setSelectedExamination] = useState('all')
  const [expandedExams, setExpandedExams] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (userData?.role === 'staff' || userData?.role === 'hod') {
      fetchAllMarksheets()
      const handler = () => fetchAllMarksheets(true)
      window.addEventListener('marksheetsUpdated', handler)
      window.addEventListener('notificationsUpdated', handler)
      return () => {
        window.removeEventListener('marksheetsUpdated', handler)
        window.removeEventListener('notificationsUpdated', handler)
      }
    } else {
      setLoading(false)
    }
  }, [userData])

  const fetchAllMarksheets = async (force = false) => {
    if (!userData) return
    setLoading(true)
    try {
      let response
      // Respect URL query params for flexible views (e.g., HNS HOD wants year=I across departments)
      const params = new URLSearchParams(window.location.search)
      const yearParam = params.get('year')
      const includeAllParam = params.get('includeAll') === 'true'
      const departmentParam = params.get('department')
      const opts = force ? { cache: false, dedupe: false } : {}

      // If HNS HOD and no explicit params provided, default to Year I across all departments
      if (userData.role === 'hod' && userData.department === 'HNS' && !yearParam && !departmentParam) {
        // treat as year=I & includeAll=true
        response = await apiClient.get(`/api/marksheets?year=I&includeAll=true`, opts)
      } else {

      if (userData.role === 'staff') {
        const staffId = userData?._id || userData?.id || localStorage.getItem('userId')
        response = await apiClient.get(`/api/marksheets?staffId=${staffId}&includeAll=true`, opts)
      } else if (userData.role === 'hod') {
        // If query explicitly requests a year and includeAll, use that (useful for HNS HOD)
        if (yearParam && includeAllParam) {
          response = await apiClient.get(`/api/marksheets?year=${encodeURIComponent(yearParam)}&includeAll=true`, opts)
        } else if (departmentParam) {
          response = await apiClient.get(`/api/marksheets?department=${encodeURIComponent(departmentParam)}&includeAll=true`, opts)
        } else {
          response = await apiClient.get(`/api/marksheets?department=${encodeURIComponent(userData.department)}&includeAll=true`, opts)
        }
      }
      // end else block for default HNS handling
      }
      
      let data
      // `apiClient.get` returns parsed JSON; legacy fetch Response has `.json()`.
      if (response && typeof response.json === 'function') {
        data = await response.json()
      } else {
        data = response
      }

      if (data && data.success) {
        setMarksheets(data.marksheets || [])
      } else if (Array.isArray(data)) {
        // allow apiClient which may return the array directly
        setMarksheets(data)
      } else {
        setMarksheets([])
      }
    } catch (err) {
      console.error('Error fetching marksheets:', err)
      setMarksheets([])
    } finally {
      setLoading(false)
    }
  }

  // Group marksheets by examination name and sort by register number
  const groupedMarksheets = useMemo(() => {
    const groups = {}
    marksheets.forEach((marksheet) => {
      const examName = marksheet.examinationName || marksheet.studentDetails?.examinationName || 'Unknown Examination'
      if (!groups[examName]) {
        groups[examName] = []
      }
      groups[examName].push(marksheet)
    })
    
    // Sort each group by register number in ascending order
    Object.keys(groups).forEach(examName => {
      groups[examName].sort((a, b) => {
        const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
        const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
        return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
      })
    })
    
    return groups
  }, [marksheets])

  // Get examination statistics
  const examinationStats = useMemo(() => {
    const stats = {}
    Object.keys(groupedMarksheets).forEach((examName) => {
      const examMarksheets = groupedMarksheets[examName]
      stats[examName] = {
        total: examMarksheets.length,
        draft: examMarksheets.filter(m => m.status === 'draft').length,
        verified: examMarksheets.filter(m => m.status === 'verified_by_staff').length,
        requested: examMarksheets.filter(m => m.status === 'dispatch_requested').length,
        approved: examMarksheets.filter(m => m.status === 'approved_by_hod').length,
        dispatched: examMarksheets.filter(m => m.status === 'dispatched').length,
        rejected: examMarksheets.filter(m => m.status === 'rejected_by_hod').length
      }
    })
    return stats
  }, [groupedMarksheets])

  // Calculate total unique examinations
  const totalExams = useMemo(() => {
    return Object.keys(groupedMarksheets).length
  }, [groupedMarksheets])

  // Filter marksheets based on selected examination and search query
  const filteredMarksheets = useMemo(() => {
    let filtered = []
    if (selectedExamination === 'all') {
      filtered = [...marksheets]
    } else {
      filtered = groupedMarksheets[selectedExamination] || []
    }
    // Apply HNS department filter if set (use case-insensitive, trimmed comparison)
    if (userData?.role === 'hod' && userData?.department === 'HNS' && departmentFilter && departmentFilter !== 'ALL') {
      const depFilterNorm = departmentFilter.toString().trim().toUpperCase()
      filtered = filtered.filter(m => ((m.studentDetails?.department || '').toString().trim().toUpperCase()) === depFilterNorm)
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((marksheet) => {
        const name = (marksheet.studentDetails?.name || '').toLowerCase()
        const regNumber = (marksheet.studentDetails?.regNumber || '').toLowerCase()
        return name.includes(query) || regNumber.includes(query)
      })
    }
    
    // Sort by register number
    return filtered.sort((a, b) => {
      const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
      const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
      return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [marksheets, selectedExamination, groupedMarksheets, searchQuery, departmentFilter, userData])

  const statusStyles = {
    draft: 'bg-gray-100 text-gray-800',
    verified_by_staff: 'bg-blue-100 text-blue-800',
    dispatch_requested: 'bg-yellow-100 text-yellow-800',
    approved_by_hod: 'bg-green-100 text-green-800',
    rejected_by_hod: 'bg-red-100 text-red-800',
    dispatched: 'bg-purple-100 text-purple-800'
  }

  const statusIcons = {
    draft: '📝',
    verified_by_staff: '📋',
    dispatch_requested: '⏳',
    approved_by_hod: '✅',
    rejected_by_hod: '⛔',
    dispatched: '📤'
  }

  // Departments available in the current marksheets (for HNS filter)
  // Normalize to trimmed uppercase to avoid duplicates like 'Mech' / ' MECH '
  const availableDepartments = useMemo(() => {
    const set = new Set()
    marksheets.forEach(m => {
      const raw = m.studentDetails?.department
      if (!raw) return
      const d = raw.toString().trim().toUpperCase()
      if (d) set.add(d)
    })
    return Array.from(set).sort()
  }, [marksheets])

  const toggleExamExpansion = (examName) => {
    setExpandedExams(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(examName)) newExpanded.delete(examName)
      else newExpanded.add(examName)
      return newExpanded
    })
  }

  const handleSetDepartment = useCallback((d) => setDepartmentFilter(d), [])
  const handleSetSelectedExamination = useCallback((exam) => setSelectedExamination(exam), [])
  const handleToggleExamExpansion = useCallback((examName) => toggleExamExpansion(examName), [toggleExamExpansion])
  const handleViewMarksheets = useCallback((id) => navigate(`/marksheets/${id}`), [navigate])

  const DepartmentButton = memo(({ d, count, active, onSelect }) => (
    <button
      onClick={() => onSelect(d)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-yellow-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
      {d} ({count})
    </button>
  ))

  const ExamButton = memo(({ examName, count, active, onSelect }) => (
    <button
      onClick={() => onSelect(examName)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
      {examName} ({count})
    </button>
  ))

  const MarksheetRow = memo(({ marksheet, onView }) => (
    <div key={marksheet._id} className="glass-card rounded-xl overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">{marksheet.studentDetails?.name}</h3>
            <p className="text-sm text-gray-600">{marksheet.studentDetails?.regNumber} • {formatYear(marksheet.studentDetails)}</p>
          </div>
        </div>
        <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
          <div>
            <p className="text-gray-500 mb-1 text-xs md:text-sm">Examination:</p>
            <p className="font-medium text-gray-900 text-sm md:text-base">{marksheet.examinationName || marksheet.studentDetails?.examinationName || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1 text-xs md:text-sm">Exam Date:</p>
            <p className="font-medium text-gray-900 text-sm md:text-base">
              {marksheet.examinationDate 
                ? new Date(marksheet.examinationDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : marksheet.studentDetails?.examinationDate 
                  ? new Date(marksheet.studentDetails.examinationDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : '—'
              }
            </p>
          </div>
          <div>
            <p className="text-gray-500 mb-1 text-xs md:text-sm">Overall Result:</p>
            <p className="font-medium text-gray-900 text-sm md:text-base">{deriveOverallResult(marksheet)}</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1 text-xs md:text-sm">Created:</p>
            <p className="font-medium text-gray-900 text-sm md:text-base">{new Date(marksheet.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex items-end md:justify-end">
            <button
              onClick={() => onView(marksheet._id)}
              className="w-full md:w-auto px-4 py-2 rounded-lg font-medium text-blue-600 border border-blue-200 bg-white hover:bg-blue-50 text-center text-sm transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  ))

  // Check if user has access
  if (!userData || (userData.role !== 'staff' && userData.role !== 'hod')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only staff members and HODs can access records.</p>
        </div>
      </div>
    )
  }

  // Calculate overall stats for visualization
  const totalRecords = marksheets.length
  const verifiedCount = marksheets.filter(m => 
    m.status === 'verified_by_staff' || 
    m.status === 'dispatch_requested' || 
    m.status === 'approved_by_hod' || 
    m.status === 'dispatched'
  ).length
  const dispatchRequestedCount = marksheets.filter(m => m.status === 'dispatch_requested').length
  const dispatchedCount = marksheets.filter(m => m.status === 'dispatched').length

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
                    Marksheet Records
                  </h1>
                  <p className="text-base sm:text-lg text-gray-600">
                    View and manage all marksheet records for {userData.department} Department
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                  <div className="glass-card px-3 py-2 rounded-xl text-center sm:text-left">
                    <div className="text-xs text-gray-500 whitespace-nowrap">Total Exams</div>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-theme-gold-600">{totalExams}</div>
                  </div>
                  <div className="glass-card px-3 py-2 rounded-xl text-center sm:text-left">
                    <div className="text-xs text-gray-500 whitespace-nowrap">Total Records</div>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{totalRecords}</div>
                  </div>
                  <div className="glass-card px-3 py-2 rounded-xl text-center sm:text-left">
                    <div className="text-xs text-gray-500">Verified</div>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{verifiedCount}</div>
                  </div>
                  <div className="glass-card px-3 py-2 rounded-xl text-center sm:text-left">
                    <div className="text-xs text-gray-500">Dispatched</div>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600">{dispatchedCount}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl mb-8">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading marksheet records...</p>
              </div>
            ) : marksheets.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Records Found</h3>
                <p className="text-gray-600">Start by importing marks to create your first marksheet records.</p>
              </div>
            ) : (
              <>
                {/* Search Bar */}
                <div className="mb-8">
                  <div className="relative max-w-2xl">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search name or register no..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base transition-shadow shadow-sm hover:shadow-md placeholder:text-sm md:placeholder:text-base"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Clear search"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <p className="mt-3 text-sm text-gray-600 font-medium">
                      {filteredMarksheets.length > 0 
                        ? `Found ${filteredMarksheets.length} result${filteredMarksheets.length !== 1 ? 's' : ''}`
                        : 'No results found'
                      }
                    </p>
                  )}
                </div>

                {/* Department Filter (HNS HOD only) */}
                {userData?.role === 'hod' && userData?.department === 'HNS' && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Filter by Department</h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setDepartmentFilter('ALL')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${departmentFilter === 'ALL' ? 'bg-yellow-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
                        All Departments ({marksheets.length})
                      </button>
                      {availableDepartments.map(d => (
                          <DepartmentButton
                            key={d}
                            d={d}
                            count={marksheets.filter(m => ((m.studentDetails?.department || '').toString().trim().toUpperCase()) === d).length}
                            active={departmentFilter === d}
                            onSelect={handleSetDepartment}
                          />
                        ))}
                    </div>
                  </div>
                )}

                {/* Examination Filter */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter by Examination</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedExamination('all')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedExamination === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      All Examinations ({marksheets.length})
                    </button>
                    {Object.keys(groupedMarksheets).sort().map((examName) => (
                      <ExamButton
                        key={examName}
                        examName={examName}
                        count={groupedMarksheets[examName].length}
                        active={selectedExamination === examName}
                        onSelect={handleSetSelectedExamination}
                      />
                    ))}
                  </div>
                </div>

                {/* Examination Overview Cards */}
                {selectedExamination === 'all' && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Examination Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.keys(groupedMarksheets).sort().map((examName) => {
                        const stats = examinationStats[examName]
                        const isExpanded = expandedExams.has(examName)
                        return (
                          <div key={examName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div 
                              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => handleToggleExamExpansion(examName)}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-gray-900 text-sm">{examName}</h4>
                                <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                  ⌄
                                </span>
                              </div>
                              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                              <p className="text-sm text-gray-600">Total Marksheets</p>
                            </div>
                          
                            {isExpanded && (
                              <div className="border-t border-gray-100 p-4 space-y-2">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                    <span>Draft: {stats.draft}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                    <span>Verified: {stats.verified}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                    <span>Requested: {stats.requested}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                    <span>Approved: {stats.approved}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                                    <span>Dispatched: {stats.dispatched}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                                    <span>Issues: {stats.rejected + stats.rescheduled}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Marksheet List */}
                <div className="space-y-4">
                  {selectedExamination !== 'all' && (
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedExamination}</h3>
                      <p className="text-gray-600">{filteredMarksheets.length} marksheets found</p>
                    </div>
                  )}
                  
                  {filteredMarksheets.map((marksheet) => (
                    <MarksheetRow key={marksheet._id} marksheet={marksheet} onView={(id) => handleViewMarksheets(id)} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatYear(details = {}) {
  const year = (details.year || '').toString()
  const section = (details.section || '').toString()
  if (!year && !section) return '—'
  if (!section) return year
  if (!year) return section
  if (year.includes('-')) return year
  return `${year}-${section}`
}

export default Records