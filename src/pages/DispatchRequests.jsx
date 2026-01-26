import { useEffect, useMemo, useState, useCallback, memo } from 'react'
import apiClient from '../utils/apiClient'
import RefreshButton from '../components/RefreshButton'
import SwipeableCard from '../components/SwipeableCard'
import usePullToRefresh, { PullToRefreshIndicator } from '../hooks/usePullToRefresh.jsx'
import { usePushNotifications, usePageFocus } from '../hooks/usePushNotifications'
import JSZip from 'jszip'

const PUBLIC_BASE_URL =
  import.meta.env.VITE_PUBLIC_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ''

const getPublicOrigin = () => {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function DispatchRequests() {
  const [userData] = useState(() => {
    const auth = localStorage.getItem('auth')
    return auth ? JSON.parse(auth) : null
  })
  const [marksheets, setMarksheets] = useState([])
  const [dispatchedMarksheets, setDispatchedMarksheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [batching, setBatching] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [requestingIds, setRequestingIds] = useState([])
  const [dispatchingId, setDispatchingId] = useState(null)
  const [sendingAll, setSendingAll] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [viewTab, setViewTab] = useState('active') // 'active' or 'history'
  const [currentExaminationId, setCurrentExaminationId] = useState(null) // Track current exam for filtering dispatch history

  // Pull-to-refresh functionality
  const handlePullRefresh = async () => {
    await fetchVerifiedMarksheets()
    setFeedback('Refreshed successfully')
    setTimeout(() => setFeedback(''), 2000)
  }

  const { isPulling, isRefreshing, pullDistance, containerRef, threshold } = usePullToRefresh(handlePullRefresh, {
    enabled: true,
    threshold: 80
  })

  useEffect(() => {
    if (userData?.role === 'staff') {
      fetchVerifiedMarksheets()
    } else {
      setLoading(false)
    }
  }, [userData])

  // Listen for global updates and force-fetch to avoid stale cached responses
  useEffect(() => {
    const handler = () => {
      if (userData?.role === 'staff') fetchVerifiedMarksheets(true)
    }
    window.addEventListener('notificationsUpdated', handler)
    window.addEventListener('marksheetsUpdated', handler)
    return () => {
      window.removeEventListener('notificationsUpdated', handler)
      window.removeEventListener('marksheetsUpdated', handler)
    }
  }, [userData])

  // Real-time push notifications
  usePushNotifications({
    'dispatch_request': () => {
      console.log('🔔 Dispatch request notification triggered refresh')
      fetchVerifiedMarksheets()
    },
    'marksheet_dispatch': () => {
      console.log('🔔 Marksheet dispatch notification triggered refresh')
      fetchVerifiedMarksheets()
    },
    'marksheet_approval': () => {
      console.log('🔔 Marksheet approval notification triggered refresh')
      fetchVerifiedMarksheets()
    }
  })

  usePageFocus(() => fetchVerifiedMarksheets())

  const fetchVerifiedMarksheets = async (force = false) => {
    if (!userData) return
    setLoading(true)
    try {
      const staffId = userData?._id || userData?.id || localStorage.getItem('userId')
      // Fetch active (non-dispatched) marksheets only
      const opts = force ? { cache: false, dedupe: false } : undefined
      const data = await apiClient.get(`/api/marksheets?staffId=${staffId}&status=verified_by_staff,dispatch_requested,approved_by_hod,rejected_by_hod`, opts)
      if (data.success) {
        const normalizeStatus = (sheet) => {
          if (sheet?.status === 'rescheduled_by_hod') {
            return {
              ...sheet,
              status: 'dispatch_requested',
              dispatchRequest: { ...(sheet.dispatchRequest || {}), hodResponse: null }
            }
          }
          return sheet
        }
        setMarksheets((data.marksheets || []).map(normalizeStatus))
      } else {
        setMarksheets([])
      }

      // Fetch already-dispatched marksheets separately for history view
      let historyData = { success: false, marksheets: [] }
      try {
        historyData = await apiClient.get(`/api/marksheets?staffId=${staffId}&status=dispatched`, opts)
        if (historyData.success) {
          const normalizeStatus = (sheet) => sheet?.status === 'rescheduled_by_hod'
            ? { ...sheet, status: 'dispatch_requested', dispatchRequest: { ...(sheet.dispatchRequest || {}), hodResponse: null } }
            : sheet
          setDispatchedMarksheets((historyData.marksheets || []).map(normalizeStatus))
        } else {
          setDispatchedMarksheets([])
        }
      } catch (historyErr) {
        console.error('Error fetching dispatched marksheets:', historyErr)
        setDispatchedMarksheets([])
      }

      // Determine most recent exam ID from BOTH active and dispatched marksheets combined
      const allMarksheets = [
        ...(data && data.success ? data.marksheets : []),
        ...(historyData && historyData.success ? historyData.marksheets : [])
      ]

      if (allMarksheets && allMarksheets.length > 0) {
        const exams = allMarksheets.map(m => ({
          id: m.examinationId,
          name: m.examinationName,
          createdAt: m.createdAt
        }))
        const uniqueExams = Array.from(new Map(exams.map(e => [e.id, e])).values())
        const mostRecentExam = uniqueExams.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        setCurrentExaminationId(mostRecentExam?.id || null)
      } else {
        setCurrentExaminationId(null)
      }
    } catch (err) {
      console.error('Error fetching marksheets:', err)
      setMarksheets([])
      setCurrentExaminationId(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchVerifiedMarksheets()
    } finally {
      setRefreshing(false)
    }
  }

  const requestDispatch = useCallback(async (marksheetId) => {
    try {
      return await apiClient.post('/api/marksheets?action=request-dispatch', { marksheetId, staffId: userData._id || userData.id })
    } catch (e) {
      return { success: false, error: e.message }
    }
  }, [userData])

  const handleRequest = useCallback(async (marksheetId) => {
    setFeedback('')
    setError('')
    setRequestingIds((ids) => Array.from(new Set([...ids, marksheetId])))
    try {
      const result = await requestDispatch(marksheetId)
      if (result?.success) {
        setFeedback('Dispatch request submitted for HOD approval.')
        setMarksheets((prev) => prev.map((m) => {
          if (m._id === marksheetId) {
            return {
              ...m,
              status: 'dispatch_requested',
              dispatchRequest: {
                ...(m.dispatchRequest || {}),
                requestedAt: new Date().toISOString(),
                requestedBy: userData?._id || userData?.id,
                hodResponse: null,
                hodComments: null,
                scheduledDispatchDate: null
              }
            }
          }
          return m
        }))
      } else {
        setError(result?.error || 'Failed to request dispatch')
      }
    } catch (err) {
      console.error(err)
      setError('Unexpected error while requesting dispatch')
    } finally {
      setRequestingIds((ids) => ids.filter((id) => id !== marksheetId))
      fetchVerifiedMarksheets()
    }
  }, [requestDispatch, userData, fetchVerifiedMarksheets])

  const requestDispatchAll = async () => {
    const candidates = marksheets.filter((m) => m.status === 'verified_by_staff')
    if (candidates.length === 0) return
    setFeedback('')
    setError('')
    setBatching(true)
    try {
      const results = []
      for (const sheet of candidates) {
        const result = await requestDispatch(sheet._id)
        results.push(result)
      }
      const okCount = results.filter((r) => r?.success).length
      const failCount = results.length - okCount
      if (okCount > 0) {
        setFeedback(`Submitted ${okCount} dispatch request${okCount > 1 ? 's' : ''} for approval.`)
      }
      if (failCount > 0) {
        setError(`Failed to submit ${failCount} request${failCount > 1 ? 's' : ''}. Please try again.`)
      }
    } finally {
      setBatching(false)
      fetchVerifiedMarksheets()
    }
  }

  const sendDispatch = useCallback(async (marksheet) => {
    if (!marksheet?._id) return
    setFeedback('')
    setError('')
    setDispatchingId(marksheet._id)
    try {
      const origin = getPublicOrigin()
      const marksheetPdfUrl = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&t=${Date.now()}` : ''
      const marksheetImageUrl = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&format=jpeg&t=${Date.now()}` : ''

      // Debug: log payload that will be sent to the API
      const payload = { marksheetId: marksheet._id, marksheetPdfUrl, marksheetImageUrl }
      console.debug('Dispatch payload:', payload)

      let data
      try {
        // Sending marksheet may take longer due to media processing — increase timeout
        data = await apiClient.post(`${origin}/api/whatsapp-dispatch?action=send-marksheet`, payload, { timeout: 60000 })
      } catch (apiErr) {
        // apiClient attaches parsed response JSON to `apiErr.data` when available
        const server = apiErr && (apiErr.data || apiErr.data?.error) ? apiErr.data : null
        const serverMsg = server ? (server.error || server.details || JSON.stringify(server)) : null
        const errMsg = serverMsg || apiErr.message || 'Failed to dispatch marksheet'
        throw new Error(errMsg)
      }

      if (!data || !data.success) {
        const errorMsg = (data && (data.details || data.error)) || 'Failed to dispatch marksheet'
        if (errorMsg.includes('Authenticate') || errorMsg.includes('authentication')) {
          throw new Error('WhatsApp API authentication failed. Please verify EVOLUTION_API_KEY in .env file. See EVOLUTION_API_SETUP.md')
        } else if (data && data.setupGuide) {
          throw new Error(`${errorMsg}. ${data.setupGuide}`)
        } else {
          throw new Error(errorMsg)
        }
      }
      setFeedback('Marksheet dispatched to parent via WhatsApp.')
      // Update both marksheets and dispatchedMarksheets to ensure it works from both views
      setMarksheets((prev) => prev.map((m) => m._id === marksheet._id ? { ...m, status: 'dispatched' } : m))
      setDispatchedMarksheets((prev) => prev.map((m) => m._id === marksheet._id ? { ...m, status: 'dispatched' } : m))
      await fetchVerifiedMarksheets()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to dispatch marksheet.')
    } finally {
      setDispatchingId(null)
    }
  }, [fetchVerifiedMarksheets])

  const sendAllApproved = async () => {
    const approvedMarksheets = marksheets.filter((m) => m.status === 'approved_by_hod')
    if (approvedMarksheets.length === 0) return

    setFeedback('')
    setError('')
    setSendingAll(true)

    try {
      const origin = getPublicOrigin()
      const results = []

      for (const marksheet of approvedMarksheets) {
        try {
          const marksheetPdfUrl = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&t=${Date.now()}` : ''
          const marksheetImageUrl = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&format=jpeg&t=${Date.now()}` : ''

          // Call API and capture either successful response or thrown error
          let responseData = null
          try {
            // Increase timeout for media send to avoid client-side aborts
            responseData = await apiClient.post(`${origin}/api/whatsapp-dispatch?action=send-marksheet`, { marksheetId: marksheet._id, marksheetPdfUrl, marksheetImageUrl }, { timeout: 60000 })
          } catch (apiErr) {
            // apiClient throws Error with .data property when available (see apiClient.request)
            const errMsg = (apiErr && (apiErr.data?.error || apiErr.data || apiErr.message)) || String(apiErr)
            results.push({ success: false, id: marksheet._id, error: errMsg })
            continue
          }

          if (responseData && responseData.success) {
            results.push({ success: true, id: marksheet._id })
            setMarksheets((prev) => prev.map((m) => m._id === marksheet._id ? { ...m, status: 'dispatched' } : m))
          } else {
            results.push({ success: false, id: marksheet._id, error: responseData?.error || 'Unknown API response' })
          }
        } catch (err) {
          results.push({ success: false, id: marksheet._id, error: err?.message || String(err) })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount

      if (successCount > 0) {
        setFeedback(`Successfully sent ${successCount} marksheet${successCount > 1 ? 's' : ''} via WhatsApp.`)
      }
      if (failCount > 0) {
        setError(`Failed to send ${failCount} marksheet${failCount > 1 ? 's' : ''}. Please try sending them individually.`)
      }
    } catch (err) {
      console.error(err)
      setError('Unexpected error while sending marksheets via WhatsApp.')
    } finally {
      setSendingAll(false)
      await fetchVerifiedMarksheets()
    }
  }

  const statusFilters = useMemo(() => {
    // Use the appropriate list based on current view tab
    const source = viewTab === 'active' ? marksheets : dispatchedMarksheets
    return [
      { id: 'all', label: 'All', count: source.length },
      { id: 'verified_by_staff', label: 'Ready', count: source.filter(m => m.status === 'verified_by_staff').length },
      { id: 'dispatch_requested', label: 'Pending', count: source.filter(m => m.status === 'dispatch_requested').length },
      { id: 'approved_by_hod', label: 'Approved', count: source.filter(m => m.status === 'approved_by_hod').length },
      { id: 'rejected_by_hod', label: 'Rejected', count: source.filter(m => m.status === 'rejected_by_hod').length },
      { id: 'dispatched', label: 'Dispatched', count: source.filter(m => m.status === 'dispatched').length }
    ]
  }, [marksheets, dispatchedMarksheets, viewTab])

  const filteredMarksheets = useMemo(() => {
    // Choose which list to filter based on active tab
    let source = viewTab === 'active' ? marksheets : dispatchedMarksheets

    // For history view, only show marksheets from the current (most recent) examination
    if (viewTab === 'history' && currentExaminationId) {
      source = source.filter(m => m.examinationId === currentExaminationId)
    }

    const filtered = statusFilter === 'all' ? source : source.filter((m) => m.status === statusFilter)
    return filtered.sort((a, b) => {
      const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
      const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
      return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [marksheets, dispatchedMarksheets, statusFilter, viewTab, currentExaminationId])

  // Count of marksheets that are approved by HOD
  const approvedCount = useMemo(() => marksheets.filter(m => m.status === 'approved_by_hod').length, [marksheets])

  const statusStyles = {
    verified_by_staff: 'bg-blue-100 text-blue-800',
    dispatch_requested: 'bg-yellow-100 text-yellow-800',
    approved_by_hod: 'bg-green-100 text-green-800',
    rejected_by_hod: 'bg-red-100 text-red-800',
    dispatched: 'bg-purple-100 text-purple-800'
  }

  const statusIcons = {
    verified_by_staff: '📋',
    dispatch_requested: '⏳',
    approved_by_hod: '✅',
    rejected_by_hod: '⛔',
    dispatched: '📤'
  }

  if (!userData || userData.role !== 'staff') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only staff members can manage dispatch requests.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Pull to Refresh Indicator */}
      <PullToRefreshIndicator
        isPulling={isPulling}
        isRefreshing={isRefreshing}
        pullDistance={pullDistance}
        threshold={threshold}
      />

      <div ref={containerRef} className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-4">Dispatch Requests</h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Submit and track WhatsApp dispatch requests for verified marksheets.<br />
              Request approval, send reports, and manage dispatch status for your students.
            </p>
          </div>
          <div className="glass-card p-8 rounded-3xl mb-8">

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading marksheets...</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 p-4 rounded-xl mb-6 text-blue-800">
                  <strong>Tip:</strong> Request dispatch after verifying marksheets. Once the HOD approves, you can send the report directly to parents via WhatsApp.
                </div>

                {/* View Tabs: Active vs Dispatched History */}
                <div className="flex items-center gap-2 mb-6 border-b border-gray-200">
                  <button
                    onClick={() => { setViewTab('active'); setStatusFilter('all') }}
                    className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${viewTab === 'active' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                  >
                    Active ({marksheets.length})
                  </button>
                  <button
                    onClick={() => { setViewTab('history'); setStatusFilter('all') }}
                    className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${viewTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                  >
                    Dispatched History ({dispatchedMarksheets.length})
                  </button>
                </div>

                {/* Empty state for current tab */}
                {((viewTab === 'active' && marksheets.length === 0) || (viewTab === 'history' && dispatchedMarksheets.length === 0)) ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No marksheets available</h3>
                    <p className="text-gray-600">{viewTab === 'active' ? 'Import and verify marksheets to begin requesting dispatch approvals.' : 'No dispatched marksheets yet.'}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                      {/* Show filters and refresh only in Active tab */}
                      {viewTab === 'active' && (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            {statusFilters.map((filter) => (
                              <button
                                key={filter.id}
                                onClick={() => setStatusFilter(filter.id)}
                                className={`px-3 py-2 rounded-full text-xs sm:text-sm font-medium border transition-colors duration-200 whitespace-nowrap ${statusFilter === filter.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-yellow-400'
                                  }`}
                              >
                                {filter.label}
                                <span className={`ml-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold ${statusFilter === filter.id ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                  {filter.count}
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="ml-auto">
                            <RefreshButton isLoading={refreshing} onClick={handleRefresh} />
                          </div>
                        </>
                      )}
                    </div>

                    {(feedback || error) && (
                      <div className="mt-0 mb-3 space-y-2">
                        {feedback && (
                          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                            {feedback}
                          </div>
                        )}
                        {error && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3">
                      {/* Show action buttons only when viewing Active tab */}
                      {viewTab === 'active' && (
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                          <button
                            onClick={requestDispatchAll}
                            disabled={batching || marksheets.every((m) => m.status !== 'verified_by_staff')}
                            className={`btn-fill inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg font-semibold whitespace-nowrap ${batching || marksheets.every((m) => m.status !== 'verified_by_staff')
                                ? 'cursor-not-allowed border border-gray-200 text-gray-500'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors'
                              }`}
                          >
                            {/* fill overlay (white -> blue) for batching */}
                            {batching && (
                              <span className="fill" style={{ backgroundColor: '#60A5FA' }} aria-hidden />
                            )}
                            <span className="relative z-10 flex items-center gap-2">
                              {batching ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Requesting...
                                </>
                              ) : (
                                '📋 Request All'
                              )}
                            </span>
                          </button>

                          <button
                            onClick={sendAllApproved}
                            disabled={sendingAll || marksheets.every((m) => m.status !== 'approved_by_hod')}
                            className={`btn-fill inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg font-semibold whitespace-nowrap ${sendingAll || marksheets.every((m) => m.status !== 'approved_by_hod')
                                ? 'cursor-not-allowed border border-gray-200 text-gray-500'
                                : 'bg-green-600 text-white hover:bg-green-700 transition-colors'
                              }`}
                          >
                            {/* green fill overlay when sending */}
                            {sendingAll && (
                              <span className="fill" style={{ backgroundColor: '#16A34A' }} aria-hidden />
                            )}
                            <span className="relative z-10 flex items-center gap-2">
                              {sendingAll ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Sending...
                                </>
                              ) : (
                                '📤 Send All'
                              )}
                            </span>
                          </button>

                          <button
                            onClick={async () => {
                              // Download all marksheets currently visible in a ZIP
                              // Only include marksheets that have been approved by HOD
                              const candidates = marksheets.filter(m => m.status === 'approved_by_hod')
                              if (!candidates || candidates.length === 0) return
                              setFeedback('')
                              setError('')
                              setDownloadingAll(true)
                              try {
                                const zip = new JSZip()
                                // Determine zip name: if all candidates share same exam/department/year, use it
                                const examNames = Array.from(new Set(candidates.map(c => c.examinationName || 'exam')))
                                const depts = Array.from(new Set(candidates.map(c => c.studentDetails?.department || 'dept')))
                                const years = Array.from(new Set(candidates.map(c => c.studentDetails?.year || 'year')))
                                const sections = Array.from(new Set(candidates.map(c => c.studentDetails?.section || 'section')))
                                let zipName = 'marksheets_' + Date.now()
                                // Preferred pattern when all candidates share the same exam, dept, year, and section
                                if (examNames.length === 1 && depts.length === 1 && years.length === 1 && sections.length === 1) {
                                  const ex = examNames[0].replace(/\s+/g, '_')
                                  const dp = String(depts[0]).replace(/\s+/g, '_')
                                  const yr = String(years[0]).replace(/\s+/g, '_')
                                  const sec = String(sections[0]).replace(/\s+/g, '_')
                                  zipName = `${ex}-${dp}-${yr}-${sec}`
                                } else if (examNames.length === 1 && depts.length === 1 && years.length === 1) {
                                  // If section differs, omit it
                                  zipName = `${examNames[0].replace(/\s+/g, '_')}-${depts[0]}-${years[0]}`
                                } else if (examNames.length === 1) {
                                  zipName = `${examNames[0].replace(/\s+/g, '_')}`
                                }

                                // Fetch each PDF and add to zip
                                for (const sheet of candidates) {
                                  try {
                                    const origin = getPublicOrigin()
                                    const ts = Date.now()
                                    const url = origin ? `${origin}/api/generate-pdf?marksheetId=${sheet._id}&t=${ts}` : `/api/generate-pdf?marksheetId=${sheet._id}&t=${ts}`
                                    try {
                                      const arrayBuffer = await apiClient.get(url, { responseType: 'arrayBuffer', timeout: 15000 })
                                      const filename = `${(sheet.studentDetails?.regNumber || sheet.studentDetails?.name || sheet._id)}_${(sheet.marksheetId || '').toString() || ''}.pdf`.replace(/[^a-zA-Z0-9_\-\.]/g, '_')
                                      zip.file(filename, arrayBuffer)
                                    } catch (e) {
                                      console.warn('Failed to fetch PDF for', sheet._id, e)
                                      continue
                                    }
                                  } catch (e) {
                                    console.error('Error fetching PDF for marksheet', sheet._id, e)
                                  }
                                }

                                const content = await zip.generateAsync({ type: 'blob' })
                                const a = document.createElement('a')
                                const url = URL.createObjectURL(content)
                                a.href = url
                                a.download = `${zipName}.zip`
                                document.body.appendChild(a)
                                a.click()
                                a.remove()
                                URL.revokeObjectURL(url)
                                setFeedback(`Prepared ${candidates.length} marksheet${candidates.length > 1 ? 's' : ''} in ${zipName}.zip`)
                              } catch (err) {
                                console.error('Download all error:', err)
                                setError('Failed to generate ZIP. Try again.')
                              } finally {
                                setDownloadingAll(false)
                              }
                            }}
                            disabled={downloadingAll || approvedCount === 0}
                            aria-disabled={downloadingAll || approvedCount === 0}
                            title={downloadingAll ? 'Preparing ZIP...' : (approvedCount === 0 ? 'Disabled until HOD approval (no approved marksheets).' : 'Download all approved marksheets as ZIP')}
                            className={`btn-fill inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg font-semibold whitespace-nowrap ${(downloadingAll || approvedCount === 0) ? 'cursor-not-allowed border border-gray-200 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700 transition-colors'}`}
                          >
                            {/* indigo fill overlay when preparing */}
                            {downloadingAll && (
                              <span className="fill" style={{ backgroundColor: '#4F46E5' }} aria-hidden />
                            )}
                            <span className="relative z-10">
                              {downloadingAll ? 'Preparing ZIP...' : '📥 Download All (ZIP)'}
                            </span>
                          </button>

                          <button
                            onClick={async () => {
                              // Regenerate signatures/results for all marksheets in the current list
                              const candidates = marksheets
                              if (!candidates || candidates.length === 0) return
                              setFeedback('')
                              setError('')
                              setRegenerating(true)
                              try {
                                const results = []
                                for (const sheet of candidates) {
                                  try {
                                    const data = await apiClient.put('/api/marksheets', { marksheetId: sheet._id, regenerateSignatures: true, recomputeResults: true })
                                    if (data && data.success) {
                                      results.push({ success: true, id: sheet._id })
                                    } else {
                                      results.push({ success: false, id: sheet._id, error: data?.error || data?.details })
                                    }
                                  } catch (err) {
                                    results.push({ success: false, id: sheet._id, error: err.message })
                                  }
                                }

                                const successCount = results.filter(r => r.success).length
                                const failCount = results.length - successCount
                                if (successCount > 0) setFeedback(`Regenerated ${successCount} marksheet${successCount > 1 ? 's' : ''}.`)
                                if (failCount > 0) setError(`Failed to regenerate ${failCount} marksheet${failCount > 1 ? 's' : ''}.`)
                              } finally {
                                setRegenerating(false)
                                await fetchVerifiedMarksheets()
                              }
                            }}
                            disabled={regenerating || marksheets.length === 0}
                            className={`btn-fill inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg font-semibold whitespace-nowrap ${regenerating || marksheets.length === 0 ? 'cursor-not-allowed border border-gray-200 text-gray-500' : 'bg-yellow-500 text-white hover:bg-yellow-600 transition-colors'}`}
                          >
                            {/* yellow fill overlay when regenerating */}
                            {regenerating && (
                              <span className="fill" style={{ backgroundColor: '#D97706' }} aria-hidden />
                            )}
                            <span className="relative z-10">{regenerating ? 'Regenerating...' : '🔁 Regenerate All'}</span>
                          </button>
                        </div>
                      )}

                      {/* Show Resend All History button only when viewing History tab */}
                      {viewTab === 'history' && (
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                          <button
                            onClick={async () => {
                              const candidates = dispatchedMarksheets.filter(m => m.status === 'dispatched')
                              if (candidates.length === 0) return

                              setFeedback('')
                              setError('')
                              setSendingAll(true)

                              try {
                                const results = []
                                for (const marksheet of candidates) {
                                  try {
                                    await sendDispatch(marksheet)
                                    results.push({ success: true })
                                  } catch (err) {
                                    results.push({ success: false, error: err.message })
                                  }
                                }

                                const successCount = results.filter(r => r.success).length
                                setFeedback(`Successfully re-sent ${successCount} marksheet${successCount > 1 ? 's' : ''} via WhatsApp.`)
                              } catch (err) {
                                setError('Error while re-sending history.')
                              } finally {
                                setSendingAll(false)
                              }
                            }}
                            disabled={sendingAll || dispatchedMarksheets.length === 0}
                            className={`inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-lg font-semibold whitespace-nowrap ${sendingAll || dispatchedMarksheets.length === 0
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 transition-colors'
                              }`}
                          >
                            {sendingAll ? 'Sending...' : '🔁 Resend All History'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      {filteredMarksheets.map((marksheet) => {
                        // Build swipe actions using stable handlers passed as props
                        const swipeActions = [];

                        if (marksheet.status === 'verified_by_staff') {
                          swipeActions.push({
                            label: 'Request',
                            icon: '📨',
                            className: 'border-blue-300 text-blue-600 hover:border-blue-500 hover:bg-blue-50',
                            onClick: () => handleRequest(marksheet._id)
                          });
                        }

                        if (marksheet.status === 'approved_by_hod') {
                          swipeActions.push(
                            {
                              label: 'Download',
                              icon: '📥',
                              className: 'border-amber-300 text-amber-600 hover:border-amber-500 hover:bg-amber-50',
                              onClick: async () => {
                                const ts = Date.now();
                                const origin = getPublicOrigin();
                                const url = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&t=${ts}` : `/api/generate-pdf?marksheetId=${marksheet._id}&t=${ts}`;
                                window.open(url, '_blank');

                                try {
                                  await apiClient.put('/api/marksheets', { marksheetId: marksheet._id, status: 'dispatched' });
                                  setMarksheets((prev) => prev.map((m) =>
                                    m._id === marksheet._id ? { ...m, status: 'dispatched' } : m
                                  ));
                                } catch (err) {
                                  console.error('Error marking marksheet as dispatched:', err);
                                }
                              }
                            },
                            {
                              label: 'Send',
                              icon: '📤',
                              className: 'border-green-300 text-green-600 hover:border-green-500 hover:bg-green-50',
                              onClick: () => sendDispatch(marksheet)
                            }
                          );
                        }

                        if (marksheet.status === 'rejected_by_hod') {
                          swipeActions.push({
                            label: 'Review',
                            icon: '👁️',
                            className: 'border-red-300 text-red-600 hover:border-red-500 hover:bg-red-50',
                            onClick: () => navigate(`/marksheets/${marksheet._id}`)
                          });
                        }

                        if (marksheet.status === 'dispatched') {
                          swipeActions.push(
                            {
                              label: 'Download',
                              icon: '📥',
                              className: 'border-amber-300 text-amber-600 hover:border-amber-500 hover:bg-amber-50',
                              onClick: () => window.open(`/api/generate-pdf?marksheetId=${marksheet._id}`, '_blank')
                            },
                            {
                              label: 'Re-send',
                              icon: '🔁',
                              className: 'border-green-300 text-green-600 hover:border-green-500 hover:bg-green-50',
                              onClick: () => sendDispatch(marksheet)
                            }
                          );
                        }

                        return (
                          <SwipeableCard key={marksheet._id} actions={swipeActions}>
                            <div className="bg-white">
                              {/* Header Section */}
                              <div className="p-4 sm:p-6 pb-3 sm:pb-4">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 break-words">{marksheet.studentDetails?.name}</h3>
                                    <p className="text-xs sm:text-sm text-gray-600">{marksheet.studentDetails?.regNumber} • {formatYear(marksheet.studentDetails)}</p>
                                  </div>
                                  <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-semibold uppercase tracking-wide flex items-center gap-0.5 sm:gap-1 flex-shrink-0 whitespace-nowrap ${statusStyles[marksheet.status] || 'bg-gray-100 text-gray-700'}`}>
                                    <span className="text-xs sm:text-sm">{statusIcons[marksheet.status] || '📄'}</span>
                                    <span className="text-xs">{(marksheet.status || '').replace(/_/g, ' ')}</span>
                                  </span>
                                </div>

                                {/* Desktop: Info Grid with Button on Right | Mobile: Full Width */}
                                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                                  {/* Info Grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 text-xs sm:text-sm flex-1">
                                    <div>
                                      <p className="text-gray-500 mb-1 font-medium">Parent:</p>
                                      <p className="font-medium text-gray-900 truncate">{marksheet.studentDetails?.parentPhoneNumber || '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 mb-1 font-medium">Requested:</p>
                                      <p className="font-medium text-gray-900">{marksheet.dispatchRequest?.requestedAt ? new Date(marksheet.dispatchRequest.requestedAt).toLocaleDateString() : '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 mb-1 font-medium">HOD Decision:</p>
                                      <p className="font-medium text-gray-900">{marksheet.dispatchRequest?.hodResponse ? marksheet.dispatchRequest.hodResponse.toUpperCase() : '—'}</p>
                                    </div>
                                  </div>

                                  {/* Action Button - Desktop Only (hidden on mobile) */}
                                  <div className="hidden sm:block w-full md:w-auto md:flex-shrink-0">
                                    {marksheet.status === 'verified_by_staff' && (
                                      <button
                                        onClick={() => handleRequest(marksheet._id)}
                                        disabled={requestingIds.includes(marksheet._id)}
                                        className={`w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-colors duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-1 ${requestingIds.includes(marksheet._id) ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}`}
                                      >
                                        {requestingIds.includes(marksheet._id) ? 'Requesting…' : 'Request Dispatch'}
                                      </button>
                                    )}

                                    {marksheet.status === 'approved_by_hod' && (
                                      <button
                                        onClick={() => sendDispatch(marksheet)}
                                        disabled={dispatchingId === marksheet._id}
                                        className={`w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-colors duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-1 ${dispatchingId === marksheet._id ? 'bg-green-300 cursor-wait' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}`}
                                      >
                                        {dispatchingId === marksheet._id ? 'Sending…' : 'Send via WhatsApp'}
                                      </button>
                                    )}

                                    {marksheet.status === 'approved_by_hod' && (
                                      <button
                                        onClick={async (e) => {
                                          e.preventDefault()
                                          const ts = Date.now()
                                          const origin = getPublicOrigin()
                                          const url = origin ? `${origin}/api/generate-pdf?marksheetId=${marksheet._id}&t=${ts}` : `/api/generate-pdf?marksheetId=${marksheet._id}&t=${ts}`
                                          window.open(url, '_blank')

                                          // Mark as dispatched when downloaded
                                          try {
                                            await apiClient.put('/api/marksheets', { marksheetId: marksheet._id, status: 'dispatched' })
                                            // Update local state
                                            setMarksheets((prev) => prev.map((m) =>
                                              m._id === marksheet._id ? { ...m, status: 'dispatched' } : m
                                            ))
                                          } catch (err) {
                                            console.error('Error marking marksheet as dispatched:', err)
                                          }
                                        }}
                                        className="mt-2 block w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-yellow-600 border border-yellow-300 bg-white hover:bg-yellow-50 hover:border-yellow-400 text-center text-xs sm:text-sm transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1"
                                      >
                                        Download PDF
                                      </button>
                                    )}

                                    {marksheet.status === 'rejected_by_hod' && (
                                      <a
                                        href={`/marksheets/${marksheet._id}`}
                                        className="block w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-red-600 border border-red-200 bg-white hover:bg-red-50 text-center text-xs sm:text-sm transition-colors duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                                      >
                                        Review Marksheet
                                      </a>
                                    )}

                                    {marksheet.status === 'dispatched' && (
                                      <>
                                        <button
                                          onClick={() => sendDispatch(marksheet)}
                                          disabled={dispatchingId === marksheet._id}
                                          className={`w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-colors duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-1 ${dispatchingId === marksheet._id ? 'bg-green-300 cursor-wait' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}`}
                                        >
                                          {dispatchingId === marksheet._id ? 'Sending…' : '📤 Re-send'}
                                        </button>
                                        <a
                                          href={`/api/generate-pdf?marksheetId=${marksheet._id}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mt-2 block w-full md:px-6 px-3 sm:px-4 py-2 rounded-lg font-medium text-yellow-600 border border-yellow-300 bg-white hover:bg-yellow-50 hover:border-yellow-400 text-center text-xs sm:text-sm transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1"
                                        >
                                          Download PDF
                                        </a>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {marksheet.dispatchRequest?.hodComments && (
                                  <div className="mt-4 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 mb-1 font-medium">HOD Comments:</p>
                                    <p className="text-gray-700 text-xs sm:text-sm">{marksheet.dispatchRequest.hodComments}</p>
                                  </div>
                                )}
                              </div>

                              {/* Mobile: Swipe instruction hint */}
                              <div className="sm:hidden p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-blue-100">
                                <p className="text-xs text-center text-gray-600 flex items-center justify-center gap-2">
                                  <span>👈</span>
                                  <span className="font-medium">Swipe left for actions</span>
                                </p>
                              </div>
                            </div>
                          </SwipeableCard>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoLine({ label, value }) {
  return (
    <div>
      <span className="block text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-gray-800">{value}</span>
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

export default DispatchRequests
