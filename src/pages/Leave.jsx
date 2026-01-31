import { useEffect, useMemo, useState } from 'react'
import apiClient from '../utils/apiClient'
import { getUserFriendlyMessage } from '../utils/apiErrorMessages'
import { Navigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import { useConfetti } from '../components/Confetti'
import SwipeableCard from '../components/SwipeableCard'
import ConfirmDialog from '../components/ConfirmDialog'
import { usePushNotifications, usePageFocus } from '../hooks/usePushNotifications'

function Leave() {
  const authStr = localStorage.getItem('auth')
  const auth = authStr ? JSON.parse(authStr) : null
  if (!auth || auth.role !== 'student') {
    return <Navigate to="/home" replace />
  }

  const { showSuccess, showError } = useAlert()
  const { celebrate, ConfettiContainer } = useConfetti()

  const [type, setType] = useState(() => {
    // Restore previous tab selection from localStorage
    return localStorage.getItem('leaveTabSelection') || 'leave'
  })
  const [reason, setReason] = useState('')
  const [reasonTouched, setReasonTouched] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expectedArrivalTime, setExpectedArrivalTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [recordingRequest, setRecordingRequest] = useState(() => {
    // Restore timer state from localStorage or sessionStorage on mount
    const saved = localStorage.getItem('activeTimer') || sessionStorage.getItem('activeTimer')
    return saved ? JSON.parse(saved) : null
  })
  const [recordingTime, setRecordingTime] = useState(0) // Timer for recording
  const [arrivalTime, setArrivalTime] = useState(null) // Store the actual arrival time
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmingArrivalId, setConfirmingArrivalId] = useState(null)

  const studentId = auth.id

  // Styles for interactive UI
  const styles = useMemo(() => `
    @keyframes pulseGlow {
      0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.6); }
      70% { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
      100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
    }
    .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }

    .segmented-control { position: relative; }
    .segmented-highlight { position: absolute; top: 0.25rem; bottom: 0.25rem; background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.2); border-radius: 0.75rem; transition: left 200ms ease; }
  `, [])

  const fetchRequests = async (force = false) => {
    try {
      setLoading(true)
      const opts = force ? { cache: false, dedupe: false } : undefined
      const data = await apiClient.get(`/api/leaves?studentId=${studentId}`, opts)
      if (data.success) {
        setRequests(data.requests || [])
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    fetchRequests()
    const handleGlobal = () => fetchRequests(true)
    window.addEventListener('notificationsUpdated', handleGlobal)
    window.addEventListener('marksheetsUpdated', handleGlobal)
    return () => {
      window.removeEventListener('notificationsUpdated', handleGlobal)
      window.removeEventListener('marksheetsUpdated', handleGlobal)
    }
  }, [])

  // Listen for push notifications and page focus changes
  usePushNotifications({
    'late_arrival': () => {
      console.log('🔔 Late arrival notification triggered refresh')
      fetchRequests()
    }
  })

  usePageFocus(() => {
    fetchRequests()
    // Restore previous tab selection from localStorage
    const savedTab = localStorage.getItem('leaveTabSelection') || 'leave'
    setType(savedTab)
  })

  // Restore timer state on visibility change (mobile-specific)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible - restore timer state
        const saved = localStorage.getItem('activeTimer')
        if (saved) {
          const savedRequest = JSON.parse(saved)
          // Check if this request still exists and needs confirmation
          setRecordingRequest(savedRequest)
        }
      }
    }

    const handlePageShow = (event) => {
      // Handle back/forward navigation on mobile (iOS Safari)
      if (event.persisted) {
        const saved = localStorage.getItem('activeTimer')
        if (saved) {
          const savedRequest = JSON.parse(saved)
          setRecordingRequest(savedRequest)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])

  // Persist timer state to localStorage whenever it changes
  useEffect(() => {
    if (recordingRequest) {
      localStorage.setItem('activeTimer', JSON.stringify(recordingRequest))
      // Also save to sessionStorage as backup for mobile
      sessionStorage.setItem('activeTimer', JSON.stringify(recordingRequest))
    } else {
      localStorage.removeItem('activeTimer')
      sessionStorage.removeItem('activeTimer')
    }
  }, [recordingRequest])

  // Save selected tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('leaveTabSelection', type)
  }, [type])

  // Timer effect for recording - updates display every second
  useEffect(() => {
    if (!recordingRequest) return
    
    const timer = setInterval(() => {
      setRecordingTime(prev => prev + 1) // This triggers a re-render to update the time display
    }, 1000)
    
    return () => clearInterval(timer)
  }, [recordingRequest])

  // Default ETA helper for late - returns just time (HH:MM)
  const defaultETA = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() + 30)
    const pad = (n) => `${n}`.padStart(2, '0')
    const hh = pad(now.getHours())
    const mi = pad(now.getMinutes())
    return `${hh}:${mi}`
  }

  useEffect(() => {
    if (type === 'late' && !expectedArrivalTime) {
      setExpectedArrivalTime(defaultETA())
    }
  }, [type])

  // Derived values & validation
  const reasonMax = 200
  const reasonCount = reason.length
  const daysCount = useMemo(() => {
    if (!startDate || !endDate) return 0
    const s = new Date(startDate)
    const e = new Date(endDate)
    const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1
    return isNaN(diff) || diff < 0 ? 0 : diff
  }, [startDate, endDate])

  useEffect(() => {
    if (startDate && endDate) {
      // Ensure endDate is not before startDate
      const s = new Date(startDate)
      const e = new Date(endDate)
      if (e < s) setEndDate(startDate)
    }
  }, [startDate, endDate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setReasonTouched(true)
    if (!reason.trim()) {
      showError('Missing reason', 'Please provide a reason.')
      return
    }
    if (reason.length > reasonMax) {
      showError('Too long', `Reason should be under ${reasonMax} characters.`)
      return
    }
    if (type === 'leave') {
      if (!startDate || !endDate) {
        showError('Missing dates', 'Please provide start and end dates.')
        return
      }
      if (daysCount <= 0) {
        showError('Invalid dates', 'End date must be the same or after start date.')
        return
      }
    } else {
      if (!expectedArrivalTime) {
        showError('Missing time', 'Please provide expected arrival time.')
        return
      }
    }
    setSubmitting(true)
    try {
      const body = {
        type,
        reason,
        regNumber: auth.regNumber,
        phoneNumber: auth.phoneNumber
      }
      if (type === 'leave') {
        body.startDate = startDate
        body.endDate = endDate
      } else {
        // Combine today's date with the time input
        const today = new Date().toISOString().split('T')[0]
        body.expectedArrivalTime = `${today}T${expectedArrivalTime}`
      }
      const data = await apiClient.post('/api/leaves?action=create', body)
      if (data && data.success) {
        showSuccess('Request submitted', `${type === 'leave' ? 'Leave' : 'Late'} request created`)
        celebrate()
        setReason('')
        setStartDate('')
        setEndDate('')
        setExpectedArrivalTime('')
        setType('leave')
        // Force-fetch to bypass cached responses so the new request appears immediately
        fetchRequests(true)
      } else {
        showError('Failed', data.error || 'Could not submit request')
      }
    } catch (err) {
      showError('Error', getUserFriendlyMessage(err, 'Could not submit. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
  
  // Format date without time for leave requests (date-only inputs)
  const formatDateOnly = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium' }) : '-'

  const handleConfirmArrival = async (request) => {
    // Prevent duplicate clicks
    if (!request || !request._id) return
    if (confirmingArrivalId) return

    // If the request status is no longer waiting for confirmation, avoid calling API
    if (request.status !== 'waiting_for_arrival_confirmation') {
      showError('Cannot confirm', 'This request is no longer awaiting your arrival confirmation.')
      // Refresh list to reflect current server state
      fetchRequests(true)
      return
    }

    setConfirmingArrivalId(request._id)
    try {
      const data = await apiClient.patch(`/api/leaves?id=${request._id}&action=confirm-arrival`, {})

      if (data && data.success) {
        // Prefer arrival time returned from server so display is accurate
        const confirmedAt = data.request && data.request.arrivalConfirmedAt ? data.request.arrivalConfirmedAt : new Date()
        setArrivalTime(confirmedAt)
        showSuccess('Success', 'Your arrival has been confirmed and parent has been notified!')
        localStorage.removeItem('activeTimer') // Clear timer from localStorage
        sessionStorage.removeItem('activeTimer') // Clear timer from sessionStorage
        setRecordingRequest(null)
        setRecordingTime(0)
        fetchRequests(true)
      } else {
        showError('Failed', data.error || 'Could not confirm arrival')
        console.error('Confirm arrival error:', data)
      }
    } catch (error) {
      // Handle AbortError (timeout) separately for friendlier messaging
      if (error && (error.name === 'AbortError' || (error.message && error.message.toLowerCase().includes('aborted')))) {
        showError('Request timed out', 'The confirmation request took too long. Please try again.')
      } else if (error && error.status === 400 && error.data && error.data.error) {
        // Backend returned a 400 with a human-friendly message (e.g., status already changed)
        showError('Cannot confirm', error.data.error)
        fetchRequests(true)
      } else {
        showError('Error', getUserFriendlyMessage(error, 'Could not complete. Please try again.'))
      }
      console.error('Confirm arrival exception:', error)
    } finally {
      setConfirmingArrivalId(null)
    }
  }
            try { window.refreshNotificationCount && window.refreshNotificationCount() } catch (e) {}

  // Called when user confirms deletion
  const performDeleteLeave = async (request) => {
    try {

      const data = await apiClient.del(`/api/leaves?id=${request._id}&action=delete`, { body: {} })

      if (data && data.success) {
        showSuccess('Success', 'Leave request deleted successfully')
        fetchRequests(true)
      } else {
        showError('Failed', data.error || 'Could not delete request')
        console.error('Delete error:', data)
      }
    } catch (error) {
      showError('Error', getUserFriendlyMessage(error, 'Could not complete. Please try again.'))
      console.error('Delete exception:', error)
    }
  }

  const handleDeleteLeave = (request) => {
    setConfirmAction({
      title: 'Delete leave request?',
      message: 'This will permanently delete your leave request. This action cannot be undone. Continue?',
      onConfirm: () => performDeleteLeave(request)
    })
  }

  return (
    <>
    <div className="px-4 py-4 w-full max-w-4xl mx-auto">
      <style>{styles}</style>
      <ConfettiContainer />
      <h1 className="text-2xl font-bold mb-4">Leave / Late</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-5 mb-6 space-y-5">
        {/* Segmented control */}
        <div className="segmented-control relative p-1 rounded-xl bg-white">
          <div 
            className="segmented-highlight"
            style={{ 
              left: type==='leave' ? '0.25rem' : 'calc(50% + 0.25rem)',
              width: 'calc(50% - 0.5rem)'
            }} 
          />
          <div className="grid grid-cols-2 gap-0">
            <button 
              type="button" 
              onClick={() => setType('leave')} 
              className={`relative z-10 px-4 py-3 rounded-xl text-sm font-bold transition-all ${type==='leave' ? 'text-blue-700' : 'text-blue-600 hover:bg-blue-50'}`}
            >
              Leave
            </button>
            <button 
              type="button" 
              onClick={() => setType('late')} 
              className={`relative z-10 px-4 py-3 rounded-xl text-sm font-bold transition-all ${type==='late' ? 'text-blue-700' : 'text-blue-600 hover:bg-blue-50'}`}
            >
              Late
            </button>
          </div>
        </div>

        {/* Reason with counter */}
        <div>
          <label className="block text-sm font-semibold mb-1">Reason</label>
          <div className="relative">
            <input 
              value={reason} 
              onChange={e=>setReason(e.target.value)} 
              onBlur={() => setReasonTouched(true)}
              maxLength={300}
              className={`w-full border rounded-xl px-3 py-3 pr-14 transition-all ${reasonTouched && !reason.trim() ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'} ${reasonCount > 160 ? 'pulse-glow' : ''}`}
              placeholder="Briefly explain your reason (e.g., Medical checkup)" 
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">{reasonCount}/{reasonMax}</div>
          </div>
          {reasonTouched && !reason.trim() && (
            <p className="text-xs text-red-600 mt-1">Please provide a reason.</p>
          )}
        </div>
        {type === 'leave' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Start Date</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e=>setStartDate(e.target.value)} 
                min={new Date().toISOString().split('T')[0]}
                className="w-full border rounded-xl px-3 py-3" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">End Date</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={e=>setEndDate(e.target.value)} 
                min={startDate || new Date().toISOString().split('T')[0]}
                className="w-full border rounded-xl px-3 py-3" 
              />
            </div>
            <div className="md:col-span-2 text-sm text-gray-600">{startDate && endDate ? `Total days: ${daysCount}` : 'Select dates to compute total days'}</div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-semibold mb-1">Expected Arrival Time</label>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex-1">
                <input 
                  type="date" 
                  value={new Date().toISOString().split('T')[0]} 
                  disabled 
                  className="w-full border rounded-xl px-3 py-3 bg-gray-100 text-gray-600 cursor-not-allowed" 
                />
              </div>
              <div className="flex-1">
                <input 
                  type="time" 
                  value={expectedArrivalTime} 
                  onChange={e=>setExpectedArrivalTime(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-3" 
                  required
                />
              </div>
            </div>
            <p className="text-xs text-gray-600">Tip: Defaults to +30 minutes from now</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button disabled={submitting} className="px-5 py-3 rounded-xl bg-blue-600 text-white disabled:opacity-50 transition-transform hover:scale-[1.02]">Submit</button>
          <button type="button" onClick={() => { setType('leave'); setReason(''); setReasonTouched(false); setStartDate(''); setEndDate(''); setExpectedArrivalTime('') }} className="px-4 py-3 rounded-xl border text-gray-700">Clear</button>
        </div>
      </form>

      {/* Live Summary */}
      <div className="bg-white rounded-2xl shadow mb-6">
        <div className="p-4 border-b"><h2 className="font-semibold">Summary</h2></div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Student:</span> {auth.name} ({auth.regNumber})</div>
          <div><span className="text-gray-500">Type:</span> {type === 'leave' ? 'Leave' : 'Late'}</div>
          {type === 'leave' ? (
            <>
              <div><span className="text-gray-500">Period:</span> {startDate || '—'} → {endDate || '—'}</div>
              <div><span className="text-gray-500">Total days:</span> {daysCount || '—'}</div>
            </>
          ) : (
            <div><span className="text-gray-500">Expected arrival:</span> {expectedArrivalTime ? `Today at ${expectedArrivalTime}` : '—'}</div>
          )}
          <div className="md:col-span-2"><span className="text-gray-500">Reason:</span> {reason || '—'}</div>
        </div>
      </div>

      {/* List of Requests */}
      <div className="bg-white rounded-2xl shadow">
        <div className="p-4 border-b"><h2 className="font-semibold">My Requests</h2></div>
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <ul className="divide-y">
            {(() => {
              const filteredRequests = requests.filter(r => r.type === type)
              
              if (filteredRequests.length === 0) {
                return (
                  <li className="p-4 text-center text-gray-500">
                    {requests.length === 0 ? 'No requests yet.' : `No ${type} requests found.`}
                  </li>
                )
              }

              return filteredRequests.map((r) => {
                // Deletable statuses (must match backend)
                const deletableStatuses = ['requested', 'waiting_for_arrival_confirmation', 'rejected_by_hod']
                const canDelete = r.type === 'leave' && deletableStatuses.includes(r.status)
                
                const swipeActions = r.type === 'leave' ? [
                  // Swipe right to delete (only if deletable)
                  ...(canDelete ? [{
                    label: 'Delete',
                    icon: '🗑️',
                    onClick: () => handleDeleteLeave(r),
                    className: 'bg-red-600 hover:bg-red-700 text-white',
                    direction: 'right',
                    autoTrigger: true
                  }] : []),
                  // Swipe left to download (only if approved)
                  ...(r.status === 'approved_by_hod' ? [{
                    label: 'Download',
                    icon: '📄',
                    onClick: () => {
                      const link = document.createElement('a')
                      link.href = `/api/generate-pdf?type=leave&leaveId=${r._id}`
                      link.download = `leave-approval-${r._id}.pdf`
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    },
                    className: 'bg-blue-600 hover:bg-blue-700 text-white'
                  }] : [])
                ] : []

                const isRecording = recordingRequest?._id === r._id

                return (
                  <li key={r._id} className="p-0 hover:bg-gray-50 transition-colors">
                    <SwipeableCard actions={swipeActions}>
                      {isRecording && r.type === 'late' && r.status === 'waiting_for_arrival_confirmation' ? (
                        // Recording state
                        <div className="px-4 py-4 bg-gradient-to-br from-green-50 to-emerald-50 border-t-2 border-green-300">
                          <div className="mb-3">
                            <div className="font-semibold text-gray-900 mb-1">Late Arrival - On the way</div>
                            <div className="text-sm text-gray-700"><strong>Reason:</strong> {r.reason}</div>
                            <div className="text-sm text-gray-600">Expected: {formatDate(r.expectedArrivalTime)}</div>
                          </div>
                          <div className="bg-white rounded-lg p-2 sm:p-3 mb-3 border border-green-200 text-center">
                            <p className="text-xs text-gray-600 mb-1">You reached at</p>
                            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 font-mono leading-tight">
                                {arrivalTime ? new Date(arrivalTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                          </div>
                          <button
                            onClick={() => handleConfirmArrival(r)}
                            disabled={confirmingArrivalId === r._id}
                            className={`w-full px-4 py-3 font-semibold rounded-lg transition-colors ${confirmingArrivalId === r._id ? 'bg-green-300 text-white cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                          >
                            ✅ I've Reached College
                          </button>
                          <button
                            onClick={() => { setRecordingRequest(null); setRecordingTime(0); setArrivalTime(null) }}
                            className="w-full px-4 py-2 mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        // Default state
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1 pr-4">
                              <div className="font-medium text-gray-900 flex items-center gap-2">
                                {r.type === 'leave' ? 'Leave' : 'Late'}
                                {r.type === 'late' && r.status === 'waiting_for_arrival_confirmation' && (
                                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">Waiting for you</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">Reason: {r.reason}</div>
                              <div className="text-sm text-gray-600">Status: {r.status}</div>
                              {r.type === 'leave' ? (
                                <div className="text-sm text-gray-600">{formatDateOnly(r.startDate)} → {formatDateOnly(r.endDate)}</div>
                              ) : (
                                <div className="text-sm text-gray-600">Expected: {formatDate(r.expectedArrivalTime)} {r.arrivalConfirmedAt ? ` | Arrived: ${formatDate(r.arrivalConfirmedAt)}` : ''}</div>
                              )}
                            </div>
                            {r.type === 'leave' && r.status === 'approved_by_hod' && (
                              <a href={`/api/generate-pdf?type=leave&leaveId=${r._id}`} className="hidden sm:flex px-3 py-2 text-sm rounded-lg border text-blue-600 border-blue-600 ml-4 flex-shrink-0">Download Letter</a>
                            )}
                          </div>
                          {/* Mobile: Swipe instruction hint */}
                          {r.type === 'leave' && (canDelete || r.status === 'approved_by_hod') && (
                            <div className="sm:hidden p-2 bg-gradient-to-r from-blue-50 to-red-50 border-t border-gray-200 rounded-b text-center space-y-1">
                              {r.status === 'approved_by_hod' && (
                                <p className="text-xs text-gray-600 flex items-center justify-center gap-2">
                                  <span>👈</span>
                                  <span className="font-medium">Swipe left to download</span>
                                </p>
                              )}
                              {canDelete && (
                                <p className="text-xs text-gray-600 flex items-center justify-center gap-2">
                                  <span>👉</span>
                                  <span className="font-medium">Swipe right to delete</span>
                                </p>
                              )}
                            </div>
                          )}
                          {r.type === 'late' && r.status === 'waiting_for_arrival_confirmation' && (
                            <div className="p-3 bg-yellow-50 border-t border-yellow-100 rounded-b text-center">
                              <button
                                onClick={() => { setRecordingRequest(r); setRecordingTime(0); setArrivalTime(null) }}
                                className="w-full px-3 py-2 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                              >
                                ⏱ Start Timer
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </SwipeableCard>
                  </li>
                )
              })
            })()}
          </ul>
        )}
      </div>
    </div>
    {confirmAction && (
      <ConfirmDialog
        open={true}
        title={confirmAction.title}
        description={confirmAction.message}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
    )}
    </>
  )
}

export default Leave
 
