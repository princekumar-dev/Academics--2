import { useEffect, useMemo, useState } from 'react'
import apiClient from '../utils/apiClient'
import { useNavigate } from 'react-router-dom'
import RefreshButton from '../components/RefreshButton'
import SwipeableCard from '../components/SwipeableCard'
import { useAlert } from '../components/AlertContext'
import { CardSkeleton, ListSkeleton } from '../components/SkeletonLoaders'
import { NoPendingRequests } from '../components/EmptyStates'
import { useConfetti } from '../components/Confetti'
import { HelpTooltip } from '../components/ContextualHelp'
import usePullToRefresh, { PullToRefreshIndicator } from '../hooks/usePullToRefresh.jsx'
import { usePushNotifications, usePageFocus } from '../hooks/usePushNotifications'

function ApprovalRequests() {
  const { showSuccess, showError, showWarning } = useAlert()
  const { celebrate, ConfettiContainer } = useConfetti()
  const [userData, setUserData] = useState(() => {
    try {
      const auth = localStorage.getItem('auth')
      return auth ? JSON.parse(auth) : null
    } catch (err) {
      console.error('Failed to parse auth data:', err)
      return null
    }
  })
  const [pendingRequests, setPendingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [actionModal, setActionModal] = useState({ open: false, type: null, marksheet: null, anchorRect: null })
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [leaveRequests, setLeaveRequests] = useState([])
  // Map department codes to friendly names (used for badges)
  const departmentDisplay = {
    'AI_DS': 'AI & DS',
    'CSE': 'CSE',
    'IT': 'IT',
    'ECE': 'ECE',
    'EEE': 'EEE',
    'MECH': 'MECH',
    'CIVIL': 'CIVIL',
    'HNS': 'H&S'
  }

  // Department color classes for badges (Tailwind)
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
  const navigate = useNavigate()

  // Pull-to-refresh functionality
  const handlePullRefresh = async () => {
    await fetchPendingRequests()
    showSuccess('🔄 Refreshed', 'Approval requests updated')
  }

  const { isPulling, isRefreshing, pullDistance, containerRef, threshold } = usePullToRefresh(handlePullRefresh, {
    enabled: true,
    threshold: 80
  })

  const fetchLeaveRequests = async () => {
    if (!userData) return
    try {
      // Fetch leave requests just to show the notice if any exist
      const params = new URLSearchParams({ department: userData.department, type: 'leave' })
      const data = await apiClient.get(`/api/leaves?${params.toString()}`)
      if (data.success) {
        const requested = (data.requests || []).filter(r => r.status === 'requested')
        setLeaveRequests(requested)
      } else {
        setLeaveRequests([])
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error)
      setLeaveRequests([])
    }
  }

  useEffect(() => {
    if (userData?.role === 'hod') {
      fetchPendingRequests()
      fetchLeaveRequests() // Still fetch to show the notice about leave requests
    } else {
      setLoading(false)
    }
  }, [userData])

  // Real-time push notifications
  usePushNotifications({
    'leave_request': () => {
      console.log('🔔 Leave request notification triggered refresh')
      fetchLeaveRequests()
    },
    'leave_approval': () => {
      console.log('🔔 Leave approval notification triggered refresh')
      fetchLeaveRequests()
    },
    'marksheet_approval': () => {
      console.log('🔔 Marksheet approval notification triggered refresh')
      fetchPendingRequests()
    },
    'dispatch_request': () => {
      console.log('🔔 Dispatch request notification triggered refresh')
      fetchPendingRequests()
    }
  })

  usePageFocus(() => {
    fetchPendingRequests()
    fetchLeaveRequests()
  })

  const fetchPendingRequests = async () => {
    if (!userData) return
    setLoading(true)
    try {
      // If logged-in HOD is HNS, they should see first-year requests across all departments
      let data
      if (userData.department === 'HNS') {
        console.log('[ApprovalRequests] HNS HOD detected — fetching Year I pending requests across departments')
        data = await apiClient.get(`/api/marksheets?year=I&status=dispatch_requested`)
      } else {
        console.log('[ApprovalRequests] Fetching with department:', userData.department)
        data = await apiClient.get(`/api/marksheets?department=${userData.department}&status=dispatch_requested`)
      }
      console.log('[ApprovalRequests] Response:', data)
      if (data && data.success) {
        setPendingRequests(data.marksheets)
      } else {
        setPendingRequests([])
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error)
      setPendingRequests([])
    } finally {
      setLoading(false)
    }
  }

  // Ensure the HOD has an electronic signature saved. Returns the latest userData with signature.
  const ensureHodSignature = async () => {
    try {
      if (userData?.eSignature) return userData
      const hodId = userData?._id || userData?.id
      if (!hodId) return null
      const profileData = await apiClient.get(`/api/users?action=profile&userId=${hodId}`)
      if (profileData?.success && profileData.user) {
        const updated = { ...userData, ...profileData.user }
        try { localStorage.setItem('auth', JSON.stringify(updated)) } catch (e) {}
        setUserData(updated)
        return updated
      }
    } catch (e) {
      console.error('[ApprovalRequests] Failed to refresh HOD profile:', e)
    }
    return userData
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchPendingRequests()
    } finally {
      setRefreshing(false)
    }
  }

  const handleAction = (event, marksheet, type) => {
    const hasWindow = typeof window !== 'undefined'
    const rect = event?.currentTarget?.getBoundingClientRect()
    const anchorRect = rect && hasWindow
      ? {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        }
      : null
    setActionError('')
    setActionModal({ open: true, type, marksheet, anchorRect })
  }

  const closeModal = () => {
    setActionModal({ open: false, type: null, marksheet: null, anchorRect: null })
    setActionError('')
  }

  const submitAction = async ({ comments }) => {
    if (!actionModal.marksheet || !actionModal.type) return
    try {
      setActionLoading(true)
      // Ensure HOD has a saved signature before allowing approve/reject
      const latest = await ensureHodSignature()
      if (!latest?.eSignature) {
        showError('Signature Missing', 'Please add your signature in Settings before approving requests')
        setActionLoading(false)
        return
      }
      const hodId = userData._id || userData.id
      const data = await apiClient.post('/api/marksheets?action=hod-response', {
        marksheetId: actionModal.marksheet._id,
        hodId,
        response: actionModal.type,
        comments
      })
      if (!data || !data.success) throw new Error(data?.error || 'Failed to submit response')
      const actionVerb = actionModal.type === 'approved' ? 'approved' : 'rejected'
      const studentName = actionModal.marksheet?.studentDetails?.name || 'Student'
      setFeedback(`Dispatch request ${actionVerb} successfully.`)
      
      // Show glassmorphism alert
      if (actionModal.type === 'approved') {
        showSuccess('✓ Approved', `Dispatch approved for ${studentName}`)
      } else {
        showWarning('Request Rejected', `Dispatch rejected for ${studentName}`)
      }
      
      closeModal()
      await fetchPendingRequests()
    } catch (err) {
      setActionError(err.message || 'Unexpected error')
      showError('Action Failed', err.message || 'Could not process the request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkAction = async (actionType) => {
    const targetRequests = filteredRequests.filter(m => m.status === 'dispatch_requested')
    if (targetRequests.length === 0) {
      setFeedback(`No pending requests available for bulk ${actionType}.`)
      return
    }

    try {
      // Ensure HOD has a saved signature before bulk actions
      const latest = await ensureHodSignature()
      if (!latest?.eSignature) {
        showError('Signature Missing', 'Please add your signature in Settings before approving requests')
        return
      }
      setBulkActionLoading(true)
      setActionError('')
      const hodId = userData._id || userData.id
      
      const promises = targetRequests.map(marksheet => 
        apiClient.post('/api/marksheets?action=hod-response', {
          marksheetId: marksheet._id,
          hodId,
          response: actionType,
          comments: ''
        }).then(r => r).catch(e => ({ success: false, error: e.message }))
      )

      const results = await Promise.all(promises)
      const successCount = results.filter(result => result.success).length
      const failCount = results.length - successCount

      if (successCount > 0) {
        const msg = `Successfully ${actionType} ${successCount} request${successCount > 1 ? 's' : ''}.${failCount > 0 ? ` ${failCount} failed.` : ''}`
        setFeedback(msg)
        showSuccess(
          `Bulk ${actionType.charAt(0).toUpperCase() + actionType.slice(1)}`,
          `${successCount}/${results.length} requests processed successfully`
        )
        if (failCount === 0) {
          celebrate() // Trigger confetti for 100% success!
        }
      } else {
        const errorMsg = `Failed to ${actionType.slice(0, -1)} any requests. Please try again.`
        setActionError(errorMsg)
        showError('Bulk Action Failed', errorMsg)
      }

      await fetchPendingRequests()
    } catch (err) {
      setActionError(err.message || `Failed to perform bulk ${actionType}`)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const statusFilters = useMemo(() => ([
    { id: 'all', label: 'All', count: pendingRequests.length },
    { id: 'dispatch_requested', label: 'Pending', count: pendingRequests.filter(m => m.status === 'dispatch_requested').length }
  ]), [pendingRequests])

  const filteredRequests = useMemo(() => {
    const filtered = selectedStatus === 'all' ? pendingRequests : pendingRequests.filter(m => m.status === selectedStatus)
    return filtered.sort((a, b) => {
      const regA = (a.studentDetails?.regNumber || '').toString().toLowerCase()
      const regB = (b.studentDetails?.regNumber || '').toString().toLowerCase()
      return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [pendingRequests, selectedStatus])

  const statusStyles = {
    dispatch_requested: 'bg-yellow-100 text-yellow-800',
    approved_by_hod: 'bg-green-100 text-green-800',
    rejected_by_hod: 'bg-red-100 text-red-800',
    dispatched: 'bg-purple-100 text-purple-800'
  }

  const statusIcons = {
    dispatch_requested: '⏳',
    approved_by_hod: '✅',
    rejected_by_hod: '⛔',
    dispatched: '📤'
  }

  const formatClass = (details = {}) => {
    const year = (details.year || '').toString()
    const section = (details.section || '').toString()
    if (!year && !section) return 'N/A'
    if (!section) return year
    if (!year) return section
    return `${year}-${section}`
  }

  if (!userData || userData.role !== 'hod') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass-card p-8 rounded-3xl text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only HODs can approve dispatch requests.</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <PullToRefreshIndicator 
        pullDistance={pullDistance} 
        threshold={threshold} 
        isRefreshing={isRefreshing} 
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-4">Approval Requests</h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Review and approve dispatch requests for {userData.department} Department
            </p>
          </div>
          
          {/* Notice: Leave Approvals moved to Notification Modal */}
          {leaveRequests.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-700">
                💡 <strong>Note:</strong> Leave request approvals have been moved to your notification inbox. Click the 🔔 bell icon to review leave requests alongside staff account approvals.
              </p>
            </div>
          )}

          <div className="glass-card p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl mb-8">

            {/* Marksheets Approval Content */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading pending requests...</p>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No pending requests</h3>
                <p className="text-gray-600">All dispatch requests have been processed</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedStatus(filter.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                        selectedStatus === filter.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      {filter.label}
                      <span className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold ${selectedStatus === filter.id ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>

                {feedback && (
                  <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                    {feedback}
                  </div>
                )}

                {actionError && (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {actionError}
                  </div>
                )}

                {/* Bulk Action Buttons */}
                <div className="mb-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">Bulk Actions</h3>
                          <HelpTooltip content="Quickly approve or reject all pending dispatch requests at once." />
                        </div>
                        <p className="text-xs text-gray-600">
                          {filteredRequests.filter(m => m.status === 'dispatch_requested').length} pending requests available
                        </p>
                      </div>
                    </div>
                    <RefreshButton isLoading={refreshing} onClick={handleRefresh} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <button
                      onClick={() => handleBulkAction('approved')}
                      disabled={bulkActionLoading || filteredRequests.filter(m => m.status === 'dispatch_requested').length === 0}
                      className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 ${
                        bulkActionLoading || filteredRequests.filter(m => m.status === 'dispatch_requested').length === 0
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        <span>✅</span>
                        <span>{bulkActionLoading ? 'Processing...' : 'Approve All'}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => handleBulkAction('rejected')}
                      disabled={bulkActionLoading || filteredRequests.filter(m => m.status === 'dispatch_requested').length === 0}
                      className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-white text-xs sm:text-sm transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 ${
                        bulkActionLoading || filteredRequests.filter(m => m.status === 'dispatch_requested').length === 0
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1">
                        <span>⛔</span>
                        <span>{bulkActionLoading ? 'Processing...' : 'Reject All'}</span>
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredRequests.map((marksheet) => {
                    const swipeActions = [
                      {
                        label: 'Details',
                        icon: '👁️',
                        className: 'border-slate-300 text-slate-600 hover:border-slate-500 hover:bg-slate-50',
                        onClick: () => navigate(`/marksheets/${marksheet._id || marksheet.marksheetId}`)
                      },
                      {
                        label: 'Reject',
                        icon: '❌',
                        className: 'border-red-300 text-red-600 hover:border-red-500 hover:bg-red-50',
                        onClick: (e) => handleAction(e, marksheet, 'rejected')
                      },
                      {
                        label: 'Approve',
                        icon: '✅',
                        className: 'border-green-300 text-green-600 hover:border-green-500 hover:bg-green-50',
                        onClick: (e) => handleAction(e, marksheet, 'approved')
                      }
                    ];

                    return (
                      <SwipeableCard key={marksheet._id} actions={swipeActions}>
                        <div className="bg-white">
                          {/* Header Section */}
                          <div className="p-4 sm:p-6 pb-3 sm:pb-4">
                            <div className="flex items-start justify-between mb-3 gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 truncate">{marksheet.studentDetails?.name}</h3>
                                <p className="text-xs sm:text-sm text-gray-600 flex items-center gap-2">
                                  <span>{marksheet.studentDetails?.regNumber} • {formatClass(marksheet.studentDetails)}</span>
                                  {marksheet.studentDetails?.department && (
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${departmentColors[marksheet.studentDetails.department] || 'bg-gray-100 text-gray-800'}`}>
                                      {departmentDisplay[marksheet.studentDetails?.department] || (marksheet.studentDetails?.department || '').toUpperCase()}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <span className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide flex items-center gap-1 whitespace-nowrap ${statusStyles[marksheet.status] || 'bg-yellow-100 text-yellow-800'}`}>
                                <span className="text-xs sm:text-sm">{statusIcons[marksheet.status] || '📄'}</span>
                                <span className="text-xs">{(marksheet.status || '').replace(/_/g, ' ')}</span>
                              </span>
                            </div>
                            
                            {/* Info Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 text-xs sm:text-sm">
                              <div>
                                <p className="text-gray-500 mb-1">Staff:</p>
                                <p className="font-medium text-gray-900 truncate">{marksheet.staffName || 'demo staff'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 mb-1">Parent Phone:</p>
                                <p className="font-medium text-gray-900">{marksheet.studentDetails?.parentPhoneNumber || '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 mb-1">Exam Date:</p>
                                <p className="font-medium text-gray-900">
                                  {marksheet.examinationDate 
                                    ? new Date(marksheet.examinationDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                    : '—'
                                  }
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 mb-1">Subjects:</p>
                                <p className="font-medium text-gray-900">{marksheet.subjects?.length || 0}</p>
                              </div>
                            </div>
                          </div>

                          {/* Divider */}
                          <div className="border-t border-gray-100"></div>
                          
                          {/* Action Buttons Section - Desktop Only */}
                          <div className="hidden sm:block p-4 sm:p-6 pt-3 sm:pt-4 bg-gray-50">
                            <div className="grid grid-cols-4 gap-3">
                              <button
                                onClick={(e) => handleAction(e, marksheet, 'approved')}
                                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                              >
                                Approve Dispatch
                              </button>
                              <button
                                onClick={(e) => handleAction(e, marksheet, 'rejected')}
                                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                              >
                                Reject Request
                              </button>
                              <button
                                onClick={() => navigate(`/marksheets/${marksheet._id || marksheet.marksheetId}`)}
                                className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-all duration-200 shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                              >
                                View Details
                              </button>
                            </div>
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

          </div>
        </div>
      </div>

      <ActionDialog
        open={actionModal.open}
        type={actionModal.type}
        marksheet={actionModal.marksheet}
        anchorRect={actionModal.anchorRect}
        onClose={closeModal}
        onSubmit={submitAction}
        loading={actionLoading}
        error={actionError}
      />
      
      {/* Confetti celebration */}
      <ConfettiContainer />
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="text-sm">
      <span className="text-gray-500 block mb-1">{label}:</span>
      <div className="font-semibold text-gray-900 break-words">{value}</div>
    </div>
  )
}

function ActionDialog({ open, type, marksheet, anchorRect, onClose, onSubmit, loading, error }) {
  const [comments, setComments] = useState('')
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : true))
  const [rendered, setRendered] = useState(open)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (open) setRendered(true)
    else {
      const t = setTimeout(() => setRendered(false), 120)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open || !marksheet) return
    setComments('')
  }, [open, type, marksheet])

  if (!rendered || !marksheet) return null

  const title = type === 'approved' ? 'Approve dispatch request' : 'Reject dispatch request'

  const submit = (e) => {
    e.preventDefault()
    const payload = { comments: comments.trim() || undefined }
    // Optimistically close the dialog immediately to avoid UI lag
    try { handleClose(true) } catch (err) { /* ignore */ }
    onSubmit(payload)
  }

  const getPositionStyle = () => {
    if (typeof window === 'undefined') {
      return {
        width: '100%',
        maxWidth: '100%',
        borderRadius: '24px 24px 0 0',
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        margin: '0 auto'
      }
    }

    // If this is a type that should be centered (approve/reject),
    // prefer a centered/top absolute modal even on mobile (avoid bottom sheet)
    const centerTypes = ['rejected', 'approved']
    if (centerTypes.includes(type)) {
      const PADDING = 16
      const MODAL_WIDTH = Math.min(420, window.innerWidth - PADDING * 2)
      const viewportWidth = window.innerWidth
      const left = Math.max(PADDING, Math.min((viewportWidth - MODAL_WIDTH) / 2, viewportWidth - MODAL_WIDTH - PADDING))
      const top = Math.max(window.scrollY + PADDING, window.scrollY + 80)
      return {
        width: MODAL_WIDTH,
        position: 'absolute',
        left,
        top
      }
    }

    if (isMobile || !anchorRect) {
      return {
        width: '100%',
        maxWidth: '100%',
        borderRadius: '24px 24px 0 0',
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        margin: '0 auto'
      }
    }

    // For reject, prefer centered modal position (consistent with approve modal look)
    const PADDING = 16
    const MODAL_WIDTH = 420
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // If this dialog is a reject action, center it horizontally and place slightly below top of viewport
    if (type === 'rejected' || type === 'approved') {
      const left = Math.max(PADDING, Math.min((viewportWidth - MODAL_WIDTH) / 2, viewportWidth - MODAL_WIDTH - PADDING))
      const top = Math.max(window.scrollY + PADDING, window.scrollY + 120)
      return {
        width: MODAL_WIDTH,
        position: 'absolute',
        left,
        top
      }
    }

    // Default: try to position adjacent to the triggering button (anchorRect)
    let left = anchorRect.left + anchorRect.width + 12

    if (left + MODAL_WIDTH > viewportWidth - PADDING) {
      left = anchorRect.left - MODAL_WIDTH - 12
      if (left < PADDING) {
        left = Math.min(
          Math.max(PADDING, anchorRect.left + anchorRect.width / 2 - MODAL_WIDTH / 2),
          viewportWidth - MODAL_WIDTH - PADDING
        )
      }
    }

    let top = anchorRect.top + anchorRect.height + 12
    const maxTop = window.scrollY + viewportHeight - 24 - 380
    if (top > maxTop) {
      top = Math.max(window.scrollY + PADDING, anchorRect.top - 380 - 12)
    }

    return {
      width: MODAL_WIDTH,
      position: 'absolute',
      left,
      top
    }
  }

  const dialogStyle = getPositionStyle()
  const handleClose = (immediate = false) => {
    if (immediate) setRendered(false)
    try { onClose() } catch (e) { /* no-op */ }
  }

  const wrapperOpacity = open ? 'opacity-100' : 'opacity-0'
  const wrapperPointer = open ? '' : 'pointer-events-none'
  const innerBase = 'glass-card w-full p-6 shadow-2xl transition-all duration-100'
  const mobileTransform = open ? 'translate-y-0 rounded-t-2xl' : 'translate-y-full rounded-t-2xl'
  const desktopTransform = open ? 'translate-y-0 scale-100' : 'translate-y-2 scale-95'
  // If this dialog is one of the center types, use desktop transform even on mobile
  const useDesktopStyle = ['rejected', 'approved'].includes(type)
  // Add subtle shadow and softer rounding for centered dialogs on mobile
  const mobileCenteredExtra = isMobile && useDesktopStyle ? 'rounded-xl shadow-lg' : ''
  const innerClasses = `${innerBase} ${mobileCenteredExtra} ${useDesktopStyle ? desktopTransform : (isMobile ? mobileTransform : desktopTransform)}`

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6 sm:py-10 ${wrapperOpacity} ${wrapperPointer}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(false) }}
      style={{ transition: 'opacity 100ms cubic-bezier(0.2,0,0,1)' }}
    >
      <div className={innerClasses} style={dialogStyle}>
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{marksheet.studentDetails?.name} • {marksheet.studentDetails?.regNumber}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comments (optional)</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={4} className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:outline-none" placeholder={type === 'rejected' ? 'Let the staff know the reason for rejection' : 'Add any notes for the staff member'} />
          </div>

          {error && (<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>)}

          <div className={`flex ${isMobile ? 'flex-col-reverse gap-2' : 'justify-end gap-3'} pt-2`}>
            <button type="button" onClick={() => handleClose(true)} className={`px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 ${isMobile ? 'w-full text-center' : ''}`}>Cancel</button>
            <button type="submit" disabled={loading} className={`px-5 py-2 rounded-lg text-white ${loading ? 'bg-blue-300 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'} ${isMobile ? 'w-full text-center' : ''}`}>{loading ? 'Saving...' : 'Confirm'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ApprovalRequests
