import { useEffect, useState } from 'react'
import apiClient from '../utils/apiClient'
import { Navigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

function LeaveApprovals() {
  const authStr = localStorage.getItem('auth')
  const auth = authStr ? JSON.parse(authStr) : null
  if (!auth || auth.role !== 'hod') {
    return <Navigate to="/home" replace />
  }
  const { showSuccess, showError } = useAlert()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState(null)

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ department: auth.department, type: 'leave', status: 'requested' })
      console.log('[LeaveApprovals] Fetching with:', { department: auth.department, type: 'leave', status: 'requested' })
      const data = await apiClient.get(`/api/leaves?${params.toString()}`)
      console.log('[LeaveApprovals] Response:', data)
      if (data.success) {
        setRequests(data.requests || [])
        setDebugInfo({ filter: data.filter, count: data.requests?.length || 0, hodDept: auth.department })
        return data
      } else {
        showError('Failed to load', data.error || 'Could not fetch requests')
        return data
      }
    } catch (e) {
      console.error('[LeaveApprovals] Error:', e)
      showError('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])
  usePullToRefresh(fetchRequests)

  // Refresh when global notifications/marksheets change (avoid stale cache)
  useEffect(() => {
    const handler = () => fetchRequests(true)
    window.addEventListener('notificationsUpdated', handler)
    window.addEventListener('marksheetsUpdated', handler)
    return () => {
      window.removeEventListener('notificationsUpdated', handler)
      window.removeEventListener('marksheetsUpdated', handler)
    }
  }, [])

  const act = async (id, action) => {
    try {
      const opts = action === 'approve' ? { timeout: 120000 } : {}
      const data = await apiClient.patch(`/api/leaves?id=${id}&action=${action}`, { hodId: auth.id }, opts)
      if (data && data.success) {
        // If approve, prefer to show WhatsApp send result if available
        if (action === 'approve' && data.whatsappResult) {
          const wr = data.whatsappResult
          if (wr.sentPdf) {
            showSuccess('Approved & Sent', 'Leave letter PDF sent via WhatsApp')
          } else if (wr.sentText) {
            showSuccess('Approved (text sent)', 'Approval text sent but PDF failed to send')
            if (wr.errors && wr.errors.length) showError('PDF send failed', wr.errors[0])
          } else {
            showSuccess('Approved', 'Request approved')
            if (wr.errors && wr.errors.length) showError('WhatsApp failed', wr.errors[0])
          }
        } else {
          showSuccess(action === 'approve' ? 'Approved' : 'Rejected', 'Request updated')
        }
        // Notify other components to refresh (header, lists)
        try { window.dispatchEvent(new Event('notificationsUpdated')) } catch (e) {}
        fetchRequests()
      } else {
        showError('Failed', data?.error || 'Could not update request')
      }
    } catch (err) {
      // Handle client-side aborts (timeout)
      if (err && (err.name === 'AbortError' || String(err).includes('signal is aborted') || String(err).includes('timeout'))) {
        // Refresh the pending requests to determine if approval actually completed on the server
        try {
          const refreshed = await fetchRequests()
          const stillPending = refreshed && refreshed.requests && refreshed.requests.find(r => r._id === id)
          if (!stillPending) {
            showSuccess('Approved', 'Request approved (server-side) — refreshed list updated')
          } else {
            showError('Timeout', 'Server took too long to respond. The approval may not have completed — check request status.')
          }
        } catch (refreshErr) {
          showError('Timeout', 'Server took too long to respond. The approval may have completed — check request status.')
        }
      } else {
        showError('Error', err.message)
      }
    }
  }

  return (
    <div className="px-4 py-4 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Leave Approvals</h1>
        <button onClick={fetchRequests} className="px-3 py-2 text-sm rounded-lg border bg-white hover:bg-gray-50" disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {debugInfo && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg text-xs">
          <div>HOD Dept: {debugInfo.hodDept}</div>
          <div>Found: {debugInfo.count} requests</div>
        </div>
      )}
      {loading ? (
        <div className="p-4 text-gray-500">Loading...</div>
      ) : (
        <ul className="divide-y bg-white rounded-xl shadow">
          {requests.map(r => (
            <li key={r._id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{r.studentDetails?.name} ({r.studentDetails?.regNumber})</div>
                <div className="text-sm text-gray-600">{new Date(r.startDate).toLocaleDateString()} → {new Date(r.endDate).toLocaleDateString()}</div>
                <div className="text-sm text-gray-600">Reason: {r.reason}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => act(r._id, 'approve')} className="px-3 py-2 text-sm rounded-lg bg-green-600 text-white">Approve</button>
                <button onClick={() => act(r._id, 'reject')} className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white">Reject</button>
              </div>
            </li>
          ))}
          {requests.length === 0 && (
            <li className="p-4 text-gray-500">No pending requests.</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default LeaveApprovals
