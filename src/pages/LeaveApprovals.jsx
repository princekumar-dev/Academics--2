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
      } else {
        showError('Failed to load', data.error || 'Could not fetch requests')
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

  const act = async (id, action) => {
    try {
      const data = await apiClient.patch(`/api/leaves?id=${id}&action=${action}`, { hodId: auth.id })
      if (data && data.success) {
        showSuccess(action==='approve'?'Approved':'Rejected', 'Request updated')
        fetchRequests()
      } else {
        showError('Failed', data?.error || 'Could not update request')
      }
    } catch (err) {
      showError('Error', err.message)
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
