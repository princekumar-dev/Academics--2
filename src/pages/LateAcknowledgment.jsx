import { useEffect, useState } from 'react'
import apiClient from '../utils/apiClient'
import { Navigate } from 'react-router-dom'
import { useAlert } from '../components/AlertContext'

function LateAcknowledgment() {
  const authStr = localStorage.getItem('auth')
  const auth = authStr ? JSON.parse(authStr) : null
  if (!auth || auth.role !== 'staff') {
    return <Navigate to="/home" replace />
  }
  const { showSuccess, showError } = useAlert()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ department: auth.department, type: 'late', status: 'requested' })
      const data = await apiClient.get(`/api/leaves?${params.toString()}`)
      if (data.success) {
        const filtered = (data.requests || []).filter(r => (
          r.studentDetails?.year === auth.year && r.studentDetails?.section === auth.section
        ))
        setRequests(filtered)
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const acknowledge = async (id) => {
    try {
      const data = await apiClient.patch(`/api/leaves?id=${id}&action=acknowledge`, { staffId: auth.id })
      if (data && data.success) {
        showSuccess('Acknowledged', 'Late arrival recorded and parent notified')
        fetchRequests()
      } else {
        showError('Failed', data?.error || 'Could not acknowledge request')
      }
    } catch (err) {
      showError('Error', err.message)
    }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'

  return (
    <div className="px-4 py-4 w-full max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Late Acknowledgment</h1>
      {loading ? (
        <div className="p-4 text-gray-500">Loading...</div>
      ) : (
        <ul className="divide-y bg-white rounded-xl shadow">
          {requests.map(r => (
            <li key={r._id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{r.studentDetails?.name} ({r.studentDetails?.regNumber})</div>
                <div className="text-sm text-gray-600">Expected: {formatDate(r.expectedArrivalTime)}</div>
                <div className="text-sm text-gray-600">Reason: {r.reason}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => acknowledge(r._id)} className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white">Record Arrival</button>
              </div>
            </li>
          ))}
          {requests.length === 0 && (
            <li className="p-4 text-gray-500">No pending late notifications.</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default LateAcknowledgment
