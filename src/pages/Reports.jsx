import { useState, useEffect } from 'react'
import apiClient from '../utils/apiClient'
import { getUserFriendlyMessage } from '../utils/apiErrorMessages'
import { HelpTooltip } from '../components/ContextualHelp'
import { deriveOverallResult, deriveSubjectResult } from '../utils/resultUtils'

function Reports() {
  const [userData, setUserData] = useState(() => {
    const auth = localStorage.getItem('auth')
    return auth ? JSON.parse(auth) : null
  })
  const [loading, setLoading] = useState(false)
  const [marksheets, setMarksheets] = useState([])
  const [reportData, setReportData] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (userData?.role === 'hod') {
      fetchDepartmentMarksheets()
    }
  }, [userData])

  const fetchDepartmentMarksheets = async () => {
    try {
      setLoading(true)
      const data = await apiClient.get(`/api/marksheets?department=${userData.department}&includeAll=true`)
      if (data.success) {
        // Sort marksheets by register number in ascending order
        const sortedMarksheets = data.marksheets.sort((a, b) => {
          const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
          const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
          return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
        })
        setMarksheets(sortedMarksheets)
      }
    } catch (err) {
      console.error('Error fetching marksheets:', err)
      setError('Failed to fetch department data')
    } finally {
      setLoading(false)
    }
  }

  const generateDepartmentSummary = () => {
    const yearWiseStats = {}
    const overallResults = {}
    const dispatched = marksheets.filter(m => m.status === 'dispatched').length
    const pending = marksheets.filter(m => m.status === 'approved_by_hod' || m.status === 'dispatch_requested').length
    const rejected = marksheets.filter(m => m.status === 'rejected_by_hod').length

    marksheets.forEach(m => {
      // Year-wise breakdown
      const year = m.studentDetails?.year || 'Unknown'
      if (!yearWiseStats[year]) {
        yearWiseStats[year] = 0
      }
      yearWiseStats[year]++

      // Result distribution
      const overallResult = deriveOverallResult(m)
      if (!overallResults[overallResult]) {
        overallResults[overallResult] = 0
      }
      overallResults[overallResult]++
    })

    const summary = {
      totalStudents: marksheets.length,
      totalMarksheets: marksheets.length,
      byStatus: {
        dispatched,
        pending,
        rejected
      },
      byYear: yearWiseStats,
      overallResults: overallResults
    }

    setReportData({ type: 'department_summary', data: summary })
  }

  const generateClasswisePerformance = () => {
    const classwiseStats = {}
    
    marksheets.forEach(m => {
      const year = m.studentDetails?.year || 'Unknown'
      const section = m.studentDetails?.section || 'Unknown'
      const classKey = year && section ? `${year}-${section}` : `Class ${year}`
      
      if (!classwiseStats[classKey]) {
        classwiseStats[classKey] = {
          year,
          section,
          totalStudents: 0,
          dispatched: 0,
          pending: 0,
          dispatchRate: 0,
          resultDistribution: {}
        }
      }
      
      classwiseStats[classKey].totalStudents++
      
      if (m.status === 'dispatched') {
        classwiseStats[classKey].dispatched++
      } else if (m.status === 'approved_by_hod' || m.status === 'dispatch_requested') {
        classwiseStats[classKey].pending++
      }

      // Track result distribution
      const overallResult = deriveOverallResult(m)
      if (!classwiseStats[classKey].resultDistribution[overallResult]) {
        classwiseStats[classKey].resultDistribution[overallResult] = 0
      }
      classwiseStats[classKey].resultDistribution[overallResult]++
    })

    // Calculate dispatch rates
    Object.values(classwiseStats).forEach(classData => {
      classData.dispatchRate = classData.totalStudents > 0 
        ? ((classData.dispatched / classData.totalStudents) * 100).toFixed(1)
        : 0
    })

    setReportData({ type: 'classwise_performance', data: classwiseStats })
  }

  const generateFailedDispatches = () => {
    // Find marksheets with failed dispatch attempts or long pending approvals
    const failedData = marksheets
      .filter(m => 
        m.status === 'rejected_by_hod' || 
        (m.status === 'approved_by_hod' && new Date(m.updatedAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      )
      .map(m => ({
        studentName: m.studentDetails?.name || 'Unknown',
        registerNumber: m.studentDetails?.registerNumber || 'Unknown',
        branch: m.studentDetails?.branch || 'Unknown',
        year: m.studentDetails?.year || 'Unknown',
        dispatchAttempts: m.dispatchAttempts || 1,
        lastDispatchAttempt: m.updatedAt || new Date()
      }))
    
    setReportData({ type: 'failed_dispatches', data: failedData })
  }

  const generateSubjectAnalysis = () => {
    const subjectStats = {}
    
    marksheets.forEach(m => {
      m.subjects?.forEach(subject => {
        const subName = subject.subjectName
        const subCode = subject.subjectCode || 'N/A'
        
        if (!subjectStats[subName]) {
          subjectStats[subName] = {
            subjectName: subName,
            subjectCode: subCode,
            totalEnrollments: 0,
            passCount: 0,
            passRate: 0,
            failCount: 0,
            failRate: 0,
            absentCount: 0,
            absentRate: 0,
            totalMarks: 0,
            marksCount: 0,
            highest: 0,
            lowest: Infinity,
            average: 0
          }
        }
        
        const statsEntry = subjectStats[subName]
        const result = deriveSubjectResult(subject)
        const marksValue = Number(subject.marks)
        const hasMarks = !Number.isNaN(marksValue)

        statsEntry.totalEnrollments++

        if (result === 'Pass') {
          statsEntry.passCount++
        } else if (result === 'Fail') {
          statsEntry.failCount++
        } else if (result === 'Absent') {
          statsEntry.absentCount++
        } else {
          statsEntry.passCount++
        }

        if (hasMarks) {
          statsEntry.totalMarks += marksValue
          statsEntry.marksCount++
          statsEntry.highest = Math.max(statsEntry.highest, marksValue)
          statsEntry.lowest = Math.min(statsEntry.lowest, marksValue)
        }
      })
    })

    // Calculate rates and averages
    Object.values(subjectStats).forEach(stats => {
      stats.passRate = stats.totalEnrollments > 0 
        ? (stats.passCount / stats.totalEnrollments) * 100
        : 0
      stats.failRate = stats.totalEnrollments > 0 
        ? (stats.failCount / stats.totalEnrollments) * 100
        : 0
      stats.absentRate = stats.totalEnrollments > 0 
        ? (stats.absentCount / stats.totalEnrollments) * 100
        : 0
      stats.average = stats.marksCount > 0 ? stats.totalMarks / stats.marksCount : 0
      if (stats.marksCount === 0) {
        stats.highest = 0
        stats.lowest = 0
      } else if (!Number.isFinite(stats.lowest)) {
        stats.lowest = 0
      }
    })

    setReportData({ type: 'subject_analysis', data: subjectStats })
  }

  const exportReport = async (format) => {
    if (!reportData) {
      alert('Please generate a report first')
      return
    }
    
    try {
      setLoading(true)
      // Map frontend types to export API types
      const typeMapping = {
        'department_summary': 'department-summary',
        'classwise_performance': 'classwise-performance', 
        'failed_dispatches': 'failed-dispatches',
        'subject_analysis': 'subject-analysis'
      }

      const exportPayload = {
        type: typeMapping[reportData.type] || reportData.type,
        data: reportData.data,
        format: format,
        department: userData.department,
        generatedBy: userData.name || userData.email,
        generatedAt: new Date().toISOString(),
        metadata: {
          totalRecords: Array.isArray(reportData.data) ? reportData.data.length : 
                      reportData.data.totalStudents || Object.keys(reportData.data).length,
          reportTitle: getReportTitle(reportData.type),
          departmentName: userData.department
        }
      }

      // Use apiClient to POST and receive a blob
      const blob = await apiClient.post('/api/generate-pdf', exportPayload, { responseType: 'blob', timeout: 30000 })
      if (!blob) throw new Error('Export failed: empty response')
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      const fileExtension = format === 'excel' ? 'xlsx' : format
      const filename = `${reportData.type}_${userData.department}_${new Date().toISOString().split('T')[0]}.${fileExtension}`
      link.download = filename
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setSuccess(`Report exported successfully as ${format.toUpperCase()}`)
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Export error:', error)
      setError(getUserFriendlyMessage(error, 'Failed to export report. Please try again.'))
      // Clear error message after 5 seconds
      setTimeout(() => setError(''), 5000)
    } finally {
      setLoading(false)
    }
  }

  const getReportTitle = (type) => {
    const titles = {
      'department_summary': 'Department Summary Report',
      'classwise_performance': 'Class-wise Performance Report', 
      'failed_dispatches': 'Failed Dispatches Report',
      'subject_analysis': 'Subject-wise Analysis Report'
    }
    return titles[type] || 'Report'
  }

  if (!userData || userData.role !== 'hod') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only HODs can generate reports.</p>
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
                    Report Management
                  </h1>
                  <p className="text-base sm:text-lg text-gray-600">
                    Generate and export reports for {userData.department} Department
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="glass-card px-3 py-2 rounded-xl">
                    <div className="text-xs text-gray-500">Total Records</div>
                    <div className="text-xl md:text-2xl font-bold text-theme-gold-600">{marksheets.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="glass-card responsive-spacing rounded-2xl md:rounded-3xl mb-6 md:mb-8">
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-red-800">{error}</div>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-green-800">{success}</div>
                </div>
              </div>
            )}

            {loading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                  <div className="text-blue-800">Loading department data...</div>
                </div>
              </div>
            )}

            {/* Quick Stats Dashboard */}
            {marksheets.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                <div className="responsive-card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm text-blue-600 font-medium mb-1">Total</p>
                      <p className="text-2xl md:text-3xl font-bold text-blue-700">{marksheets.length}</p>
                    </div>
                    <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="responsive-card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm text-green-600 font-medium mb-1">Dispatched</p>
                      <p className="text-2xl md:text-3xl font-bold text-green-700">{marksheets.filter(m => m.status === 'dispatched').length}</p>
                    </div>
                    <svg className="w-8 h-8 md:w-10 md:h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="responsive-card bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm text-yellow-600 font-medium mb-1">Pending</p>
                      <p className="text-2xl md:text-3xl font-bold text-yellow-700">{marksheets.filter(m => ['approved_by_hod', 'dispatch_requested'].includes(m.status)).length}</p>
                    </div>
                    <svg className="w-8 h-8 md:w-10 md:h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="responsive-card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm text-red-600 font-medium mb-1">Rejected</p>
                      <p className="text-2xl md:text-3xl font-bold text-red-700">{marksheets.filter(m => m.status === 'rejected_by_hod').length}</p>
                    </div>
                    <svg className="w-8 h-8 md:w-10 md:h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            <div className="responsive-grid responsive-grid-2 lg:grid-cols-3">
              {/* Department Summary Report */}
              <div className="responsive-card group hover:shadow-xl transition-all duration-300 bg-white border-2 border-blue-100 hover:border-blue-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                    <svg className="w-6 h-6 md:w-7 md:h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Overview</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-base md:text-lg font-bold text-gray-900">Department Summary</h3>
                  <HelpTooltip content="Shows overall statistics including status breakdown, year-wise distribution, and pass/fail/absent analysis for all marksheets." />
                </div>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">Complete overview with status breakdown, year-wise stats, and result distribution</p>
                <button 
                  onClick={generateDepartmentSummary}
                  disabled={loading}
                  className="responsive-button w-full bg-blue-600 text-white hover:bg-white hover:text-blue-600 hover:border-2 hover:border-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </span>
                  ) : 'Generate Report'}
                </button>
              </div>

              {/* Class-wise Performance */}
              <div className="responsive-card group hover:shadow-xl transition-all duration-300 bg-white border-2 border-green-100 hover:border-green-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                    <svg className="w-6 h-6 md:w-7 md:h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">Performance</span>
                </div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">Class-wise Analysis</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">Detailed breakdown by year/section with dispatch rates and result distribution</p>
                <button 
                  onClick={generateClasswisePerformance}
                  disabled={loading}
                  className="responsive-button w-full bg-green-600 text-white hover:bg-white hover:text-green-600 hover:border-2 hover:border-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </span>
                  ) : 'Generate Report'}
                </button>
              </div>

              {/* Failed Dispatches */}
              <div className="responsive-card group hover:shadow-xl transition-all duration-300 bg-white border-2 border-red-100 hover:border-red-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-red-100 rounded-xl group-hover:bg-red-200 transition-colors">
                    <svg className="w-6 h-6 md:w-7 md:h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">Issues</span>
                </div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">Failed Dispatches</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">Marksheets with failed dispatch attempts or pending for over 7 days</p>
                <button 
                  onClick={generateFailedDispatches}
                  disabled={loading}
                  className="responsive-button w-full bg-red-600 text-white hover:bg-white hover:text-red-600 hover:border-2 hover:border-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </span>
                  ) : 'View Issues'}
                </button>
              </div>

              {/* Mark Sheet Changes */}
              <div className="responsive-card group hover:shadow-xl transition-all duration-300 bg-white border-2 border-yellow-100 hover:border-yellow-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-yellow-100 rounded-xl group-hover:bg-yellow-200 transition-colors">
                    <svg className="w-6 h-6 md:w-7 md:h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">Tracking</span>
                </div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">Change History</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">Track modifications in student details, phone numbers, grades, and marksheet data</p>
                <button 
                  onClick={() => alert('Change tracking feature coming soon!')}
                  disabled={loading}
                  className="responsive-button w-full bg-yellow-600 text-white hover:bg-white hover:text-yellow-600 hover:border-2 hover:border-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </span>
                  ) : 'View Changes'}
                </button>
              </div>

              {/* Subject-wise Analysis */}
              <div className="responsive-card group hover:shadow-xl transition-all duration-300 bg-white border-2 border-purple-100 hover:border-purple-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                    <svg className="w-6 h-6 md:w-7 md:h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Analytics</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">Subject Analysis</h3>
                  <HelpTooltip content="Performance metrics for each subject with pass rate, fail rate, and absent rate" />
                </div>
                <p className="text-sm text-gray-600 mb-4">Performance metrics for each subject with pass rate, fail rate, and absent rate.</p>
                <button 
                  onClick={generateSubjectAnalysis}
                  disabled={loading}
                  className="responsive-button w-full bg-purple-600 text-white hover:bg-white hover:text-purple-600 hover:border-2 hover:border-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </span>
                  ) : 'Generate Report'}
                </button>
              </div>

              {/* Custom Report */}
              <div className="responsive-card group hover:shadow-xl transition-all duration-300 bg-white border-2 border-indigo-100 hover:border-indigo-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-indigo-100 rounded-xl group-hover:bg-indigo-200 transition-colors">
                    <svg className="w-6 h-6 md:w-7 md:h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">Custom</span>
                </div>
                <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2">Custom Report Builder</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">Create tailored reports with specific filters, date ranges, and custom criteria</p>
                <button 
                  onClick={() => alert('Custom report builder coming soon!')}
                  disabled={loading}
                  className="responsive-button w-full bg-indigo-600 text-white hover:bg-white hover:text-indigo-600 hover:border-2 hover:border-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </span>
                  ) : 'Create Custom'}
                </button>
              </div>
            </div>

            {/* Report Display */}
            {reportData && (
              <div className="mt-6 md:mt-8 responsive-card bg-white border-2 border-gray-200">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                  <div>
                    <h3 className="responsive-heading-2 text-gray-900 mb-1">
                      {reportData.type === 'department_summary' && 'Department Summary'}
                      {reportData.type === 'classwise_performance' && 'Class-wise Performance'}
                      {reportData.type === 'failed_dispatches' && 'Failed Dispatches'}
                      {reportData.type === 'subject_analysis' && 'Subject Analysis'}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-500">
                      Generated on {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="p-2 bg-theme-gold-100 rounded-lg">
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-theme-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                
                {reportData.type === 'department_summary' && (
                  <div className="space-y-6">
                    {/* Status Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                      <div className="responsive-card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs md:text-sm text-blue-600 font-medium mb-1">Total</p>
                            <p className="text-2xl md:text-3xl font-bold text-blue-700">{reportData.data.totalStudents}</p>
                          </div>
                          <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="responsive-card bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs md:text-sm text-green-600 font-medium mb-1">Dispatched</p>
                            <p className="text-2xl md:text-3xl font-bold text-green-700">{reportData.data.byStatus.dispatched}</p>
                          </div>
                          <svg className="w-8 h-8 md:w-10 md:h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="responsive-card bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs md:text-sm text-yellow-600 font-medium mb-1">Pending</p>
                            <p className="text-2xl md:text-3xl font-bold text-yellow-700">{reportData.data.byStatus.pending}</p>
                          </div>
                          <svg className="w-8 h-8 md:w-10 md:h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="responsive-card bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs md:text-sm text-red-600 font-medium mb-1">Rejected</p>
                            <p className="text-2xl md:text-3xl font-bold text-red-700">{reportData.data.byStatus.rejected}</p>
                          </div>
                          <svg className="w-8 h-8 md:w-10 md:h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    {/* Distribution Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                      <div className="responsive-card bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <h4 className="text-base md:text-lg font-bold text-indigo-900 leading-none">Year-wise Distribution</h4>
                        </div>
                        <div className="space-y-3">
                          {reportData.data.byYear && Object.entries(reportData.data.byYear).map(([year, count]) => (
                            <div key={year} className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                <span className="text-sm md:text-base font-medium text-gray-700">Year {year}</span>
                              </div>
                              <span className="text-base md:text-lg font-bold text-indigo-600">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="responsive-card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                        <div className="flex items-center gap-2 mb-4">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <h4 className="text-base md:text-lg font-bold text-purple-900">Result Distribution</h4>
                        </div>
                        <div className="space-y-3">
                          {reportData.data.overallResults && Object.entries(reportData.data.overallResults).map(([result, count]) => (
                            <div key={result} className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                <span className="text-sm md:text-base font-medium text-gray-700">{result}</span>
                              </div>
                              <span className="text-base md:text-lg font-bold text-purple-600">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reportData.type === 'failed_dispatches' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg border border-red-200">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-sm md:text-base font-semibold text-red-900">Found {reportData.data.length} marksheets with issues</p>
                        <p className="text-xs md:text-sm text-red-700">These marksheets may have failed dispatch or are pending for over 7 days</p>
                      </div>
                    </div>
                    
                    {reportData.data.length === 0 ? (
                      <div className="responsive-card bg-green-50 border-green-200 text-center py-8">
                        <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-base md:text-lg font-semibold text-green-900">No Failed Dispatches!</p>
                        <p className="text-sm text-green-700 mt-1">All marksheets are processing normally</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {reportData.data.map((item, index) => (
                          <div key={index} className="responsive-card bg-white border-2 border-red-100 hover:border-red-300 hover:shadow-lg transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                                <div>
                                  <h5 className="text-sm md:text-base font-bold text-gray-900">{item.studentName}</h5>
                                  <p className="text-xs md:text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Reg No:</span> {item.registerNumber}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Year {item.year} • {item.branch}
                                  </p>
                                  {item.dispatchAttempts > 1 && (
                                    <p className="text-xs text-red-600 mt-1 font-medium">
                                      {item.dispatchAttempts} dispatch attempts
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full">Failed</span>
                                <p className="text-xs text-gray-500">
                                  {new Date(item.lastDispatchAttempt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {reportData.type === 'subject_analysis' && (
                  <div className="space-y-4">
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                      {reportData.data && Object.entries(reportData.data).map(([subject, stats], index) => (
                        <div key={subject} className="responsive-card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:shadow-lg transition-all">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 bg-purple-200 rounded-lg">
                              <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h5 className="text-sm md:text-base font-bold text-purple-900">{subject}</h5>
                              <p className="text-xs text-purple-700">Subject Code: {stats.subjectCode}</p>
                            </div>
                            <span className="text-xs font-semibold text-purple-600 bg-purple-200 px-2 py-1 rounded-full">
                              {stats.totalEnrollments} Students
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="bg-white p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Average</p>
                              <p className="text-lg md:text-xl font-bold text-purple-700">{stats.average.toFixed(1)}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Highest</p>
                              <p className="text-lg md:text-xl font-bold text-green-600">{stats.highest}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Lowest</p>
                              <p className="text-lg md:text-xl font-bold text-red-600">{stats.lowest}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Pass Rate</p>
                              <p className="text-lg md:text-xl font-bold text-blue-600">{stats.passRate.toFixed(1)}%</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reportData.type === 'classwise_performance' && (
                  <div className="space-y-4">
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                      {reportData.data && Object.entries(reportData.data).map(([classKey, data]) => (
                        <div key={classKey} className="responsive-card bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-200 rounded-lg">
                                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <div>
                                <h5 className="text-base md:text-lg font-bold text-green-900">Class {classKey}</h5>
                                <p className="text-xs md:text-sm text-green-700">Year {data.year} - Section {data.section}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-xs font-semibold text-green-600 bg-green-200 px-3 py-1 rounded-full">
                                {data.totalStudents} Students
                              </span>
                              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                                {data.dispatchRate}% Dispatched
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                            <div className="bg-white p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Total</p>
                              <p className="text-lg md:text-xl font-bold text-green-700">{data.totalStudents}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Dispatched</p>
                              <p className="text-lg md:text-xl font-bold text-blue-600">{data.dispatched}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Pending</p>
                              <p className="text-lg md:text-xl font-bold text-yellow-600">{data.pending}</p>
                            </div>
                          </div>
                          
                          {data.resultDistribution && Object.keys(data.resultDistribution).length > 0 && (
                            <div className="bg-white p-3 rounded-lg">
                              <p className="text-xs font-semibold text-gray-700 mb-2">Result Distribution</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(data.resultDistribution).map(([result, count]) => (
                                  <span key={result} className="text-xs font-medium bg-gradient-to-r from-green-100 to-green-200 text-green-800 px-3 py-1 rounded-full">
                                    {result}: {count}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Export Options Section */}
            <div className="mt-6 md:mt-8 responsive-card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base md:text-lg font-bold text-blue-900">Export Report</h4>
                  <p className="text-xs md:text-sm text-blue-700">Download in your preferred format</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button 
                  onClick={() => exportReport('pdf')}
                  disabled={!reportData || loading}
                  className="responsive-button flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-300 bg-blue-600 text-white hover:bg-white hover:text-blue-600 hover:border-2 hover:border-blue-600"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="hidden sm:inline">PDF</span>
                      <span className="sm:hidden">Export PDF</span>
                    </>
                  )}
                </button>
                
                <button 
                  onClick={() => exportReport('excel')}
                  disabled={!reportData || loading}
                  className="responsive-button flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-300 bg-green-600 text-white hover:bg-white hover:text-green-600 hover:border-2 hover:border-green-600"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="hidden sm:inline">Excel</span>
                      <span className="sm:hidden">Export Excel</span>
                    </>
                  )}
                </button>
                
                <button 
                  onClick={() => exportReport('csv')}
                  disabled={!reportData || loading}
                  className="responsive-button flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-300 bg-gray-700 text-white hover:bg-white hover:text-gray-700 hover:border-2 hover:border-gray-700"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="hidden sm:inline">CSV</span>
                      <span className="sm:hidden">Export CSV</span>
                    </>
                  )}
                </button>
              </div>
              
              {!reportData && (
                <div className="mt-4 p-3 bg-blue-100 rounded-lg flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-800">Generate a report first to enable export options</p>
                </div>
              )}
              
              {loading && (
                <div className="mt-4 p-3 bg-blue-100 rounded-lg flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-blue-800">Processing your export request...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Reports
