import { useState, useEffect } from 'react'
import apiClient from '../utils/apiClient'
import ReactDOM from 'react-dom'
import { X, UserCheck, UserX, Clock, CheckCircle, XCircle, Bell } from 'lucide-react'
import SwipeableCard from './SwipeableCard'
import { usePushNotifications } from '../hooks/usePushNotifications'

export default function NotificationRequests({ isOpen, onClose, setUnreadCount }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [userRole, setUserRole] = useState('')
  const [staffStatus, setStaffStatus] = useState(null)

  useEffect(() => {
    if (isOpen) {
      console.log('[NotificationRequests] Modal opened, isOpen:', isOpen)
      const auth = JSON.parse(localStorage.getItem('auth') || '{}')
      const userRole = auth?.role || auth.user?.role || ''
      console.log('[NotificationRequests] Auth from localStorage:', auth)
      console.log('[NotificationRequests] User role detected:', userRole)
      setUserRole(userRole)
      setLoading(true)
      setTimeout(() => {
        console.log('[NotificationRequests] About to call fetchRequests, userRole:', userRole)
        fetchRequests()
      }, 0)
    }
  }, [isOpen])

  // Real-time push notifications - only listen when modal is open
  usePushNotifications(isOpen ? {
    'late_arrival': () => {
      console.log('🔔 Late arrival notification triggered refresh in NotificationRequests')
      fetchRequests()
    },
    'leave_request': () => {
      console.log('🔔 Leave request notification triggered refresh in NotificationRequests')
      fetchRequests()
    },
    'staff_approval': () => {
      console.log('🔔 Staff approval notification triggered refresh in NotificationRequests')
      fetchRequests()
    },
    'marksheet_dispatch': () => {
      console.log('🔔 Marksheet dispatch notification triggered refresh in NotificationRequests')
      fetchRequests()
    }
  } : {})

  const fetchRequests = async () => {
    try {
      console.log('[NotificationRequests] fetchRequests called')
      setLoading(true)
      const auth = JSON.parse(localStorage.getItem('auth') || '{}')
      console.log('[NotificationRequests] Full auth object:', auth)
      console.log('[NotificationRequests] Auth user object:', auth.user)
      
      const userRole = auth?.role || auth.user?.role
      const userId = auth?.id || auth.user?.id
      
      console.log('[NotificationRequests] Fetching for user:', userRole, userId)
      
      if (userRole === 'hod') {
        const hodId = userId
        console.log('[NotificationRequests] HOD ID to send:', hodId)
        
        if (!hodId) {
          console.error('[NotificationRequests] ERROR: No HOD ID found!')
          setRequests([])
          setLoading(false)
          return
        }
        
        // Fetch both staff approval requests and leave requests
        const staffApiUrl = `/api/staff-approval?action=pending&hodId=${hodId}`
        const auth = JSON.parse(localStorage.getItem('auth') || '{}')
        const department = auth?.department || auth.user?.department
        const leaveApiUrl = `/api/leaves?department=${department}&type=leave`
        
        console.log('[NotificationRequests] Staff API URL:', staffApiUrl)
        console.log('[NotificationRequests] Leave API URL:', leaveApiUrl)
        
        try {
          const [staffData, leaveData] = await Promise.all([
            apiClient.get(staffApiUrl),
            apiClient.get(leaveApiUrl)
          ])
          
          console.log('[NotificationRequests] Staff Data:', staffData)
          console.log('[NotificationRequests] Leave Data:', leaveData)
          
          const allRequests = []
          
          // Process staff requests
          if (staffData.success && staffData.requests) {
            const staffRequests = (staffData.requests || []).map(req => ({
              _id: req.id,
              type: 'staff_account_approval',
              createdAt: req.createdAt,
              data: {
                requestId: req.id,
                staffName: req.name,
                staffEmail: req.email,
                phoneNumber: req.phoneNumber,
                department: req.department,
                year: req.year,
                section: req.section,
                status: 'pending'
              }
            }))
            console.log('[NotificationRequests] Converted staff requests:', staffRequests)
            allRequests.push(...staffRequests)
          }
          
          // Process leave requests
          if (leaveData.success && leaveData.requests) {
            const leaveRequests = (leaveData.requests || [])
              .filter(r => r.status === 'requested')
              .map(req => ({
                _id: req._id,
                type: 'leave_request',
                createdAt: req.createdAt,
                data: {
                  requestId: req._id,
                  studentName: req.studentDetails?.name,
                  regNumber: req.studentDetails?.regNumber,
                  department: req.studentDetails?.department,
                  year: req.studentDetails?.year,
                  section: req.studentDetails?.section,
                  reason: req.reason,
                  startDate: req.startDate,
                  endDate: req.endDate,
                  type: req.type,
                  status: 'pending'
                }
              }))
            console.log('[NotificationRequests] Converted leave requests:', leaveRequests)
            allRequests.push(...leaveRequests)
          }
          
          console.log('[NotificationRequests] Total requests:', allRequests.length)
          setRequests(allRequests)
        } catch (error) {
          console.error('[NotificationRequests] Error fetching requests:', error)
          setRequests([])
        }
      } else if (userRole === 'staff') {
        // For Staff: Check approval status from notifications + late requests
        const data = await apiClient.get(`/api/notifications?userEmail=${auth?.email || auth.user?.email}`)
        
        let allRequests = []
        
        if (data.success) {
          const ownRequest = data.notifications.find(
            n => n.type === 'staff_account_approval' && 
            n.data?.staffEmail === (auth?.email || auth.user?.email)
          )
          if (ownRequest) {
            setStaffStatus({
              status: ownRequest.data?.status || 'pending',
              processedAt: ownRequest.data?.processedAt,
              department: ownRequest.data?.department,
              year: ownRequest.data?.year,
              section: ownRequest.data?.section,
              createdAt: ownRequest.createdAt
            })
          }
        }
        
        // Fetch late arrival requests for staff's year/section
        if (auth?.year && auth?.section && auth?.department) {
          try {
            const lateData = await apiClient.get(`/api/leaves?department=${auth.department}&type=late&status=requested`)
            
            if (lateData.success && lateData.requests) {
              const lateRequests = (lateData.requests || [])
                .filter(r => r.studentDetails?.year === auth.year && r.studentDetails?.section === auth.section)
                .map(req => ({
                  _id: req._id,
                  type: 'late_arrival',
                  createdAt: req.createdAt,
                  data: {
                    requestId: req._id,
                    studentName: req.studentDetails?.name,
                    regNumber: req.studentDetails?.regNumber,
                    department: req.studentDetails?.department,
                    year: req.studentDetails?.year,
                    section: req.studentDetails?.section,
                    reason: req.reason,
                    expectedArrivalTime: req.expectedArrivalTime,
                    type: req.type,
                    status: 'pending'
                  }
                }))
              console.log('[NotificationRequests] Late requests for staff:', lateRequests)
              allRequests = [...allRequests, ...lateRequests]
            }
          } catch (error) {
            console.error('[NotificationRequests] Error fetching late requests:', error)
          }
        }
        
        setRequests(allRequests)
      } else if (userRole === 'admin') {
        // Admin: fetch notifications targeted to the admin account
        const email = auth?.email || auth.user?.email
        if (!email) {
          setRequests([])
        } else {
          const data = await apiClient.get(`/api/notifications?userEmail=${encodeURIComponent(email)}`)
          if (data.success && Array.isArray(data.notifications)) {
            const normalized = data.notifications.map(n => ({
              _id: n._id,
              type: n.type || 'system',
              title: n.title || 'System notification',
              body: n.body || n.message || 'No details provided',
              createdAt: n.createdAt,
              read: !!n.read,
              data: n.data || {}
            }))
            setRequests(normalized)
            if (setUnreadCount) {
              setUnreadCount(normalized.filter(n => !n.read).length)
            }
          } else {
            setRequests([])
          }
        }
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (request) => {
    // For late arrival: only record (mark as waiting for student confirmation)
    if (request.type === 'late_arrival') {
      setProcessing(request._id)
      
      try {
        const auth = JSON.parse(localStorage.getItem('auth') || '{}')
        const staffId = auth?.id || auth.user?.id
        
        // Step 1: Record the action (just update status, don't send notification yet)
        try {
          await apiClient.patch(`/api/leaves?id=${request.data.requestId}&action=acknowledge`, { staffId })
          // Remove from list
          setRequests(prev => prev.filter(r => r._id !== request._id))
          console.log('✅ Late arrival recorded, waiting for student confirmation')
        } catch (err) {
          console.error('Error recording late arrival:', err)
        }
      } catch (error) {
        console.error('Error recording late arrival:', error)
      } finally {
        setProcessing(null)
      }
      return
    }

    // For other request types: proceed normally
    setProcessing(request._id)
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}')
      const hodId = auth?.id || auth.user?.id
      
      let response
      
      try {
        if (request.type === 'staff_account_approval') {
          await apiClient.patch('/api/staff-approval', { requestId: request.data.requestId, action: 'approve', hodId })
        } else if (request.type === 'leave_request') {
          await apiClient.patch(`/api/leaves?id=${request.data.requestId}&action=approve`, { hodId })
        }
        // Remove from list
        setRequests(prev => prev.filter(r => r._id !== request._id))
      } catch (err) {
        console.error('Error approving request:', err)
      }
    } catch (error) {
      console.error('Error approving request:', error)
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (request) => {
    setProcessing(request._id)
    try {
      const reason = prompt('Enter rejection reason (optional):')
      if (reason === null) {
        setProcessing(null)
        return
      }
      
      const auth = JSON.parse(localStorage.getItem('auth') || '{}')
      const hodId = auth?.id || auth.user?.id
      
      let response
      
      try {
        if (request.type === 'staff_account_approval') {
          await apiClient.patch('/api/staff-approval', { requestId: request.data.requestId, action: 'reject', hodId, rejectionReason: reason })
        } else if (request.type === 'leave_request') {
          await apiClient.patch(`/api/leaves?id=${request.data.requestId}&action=reject`, { hodId, reason })
        }
        // Remove from list
        setRequests(prev => prev.filter(r => r._id !== request._id))
      } catch (err) {
        console.error('Error rejecting request:', err)
      }
    } catch (error) {
      console.error('Error rejecting request:', error)
    } finally {
      setProcessing(null)
    }
  }

  const markNotificationAsRead = async (notificationId) => {
    try {
      await apiClient.patch(`/api/notifications/${notificationId}/read`)
      setRequests(prev => {
        const updated = prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
        if (setUnreadCount) {
          setUnreadCount(updated.filter(n => !n.read).length)
        }
        return updated
      })
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllNotificationsAsRead = async () => {
    try {
      const unread = requests.filter(n => !n.read)
      await Promise.all(unread.map(n => apiClient.patch(`/api/notifications/${n._id}/read`)))
      setRequests(prev => prev.map(n => ({ ...n, read: true })))
      if (setUnreadCount) setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  if (!isOpen) return null

  if (userRole === 'admin') {
    const unreadCount = requests.filter(n => !n.read).length
    const modalContent = (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-theme-gold/10 to-theme-gold/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-theme-gold-gradient flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Notifications</h2>
                <p className="text-xs sm:text-sm text-gray-600">System updates for admin</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllNotificationsAsRead}
                  className="text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-gold"></div>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">No notifications</p>
                <p className="text-sm text-gray-500 mt-1">Everything is up to date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((notification) => (
                  <div
                    key={notification._id}
                    className={`border rounded-xl p-4 sm:p-5 transition-all ${notification.read ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${notification.read ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                            {notification.type?.replace(/_/g, ' ') || 'notification'}
                          </span>
                          {!notification.read && <span className="text-[11px] font-semibold text-blue-700">NEW</span>}
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 break-words">{notification.title}</h3>
                        <p className="text-xs sm:text-sm text-gray-700 mt-1 break-words">{notification.body}</p>
                        <p className="text-[11px] text-gray-500 mt-2">
                          {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Just now'}
                        </p>
                      </div>
                      {!notification.read && (
                        <button
                          onClick={() => markNotificationAsRead(notification._id)}
                          className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-3 py-1.5 rounded-lg hover:bg-green-100"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )

    return ReactDOM.createPortal(modalContent, document.body)
  }

  // Staff View - Show their own registration status + late arrival requests
  if (userRole === 'staff') {
    const modalContent = (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-theme-gold/10 to-theme-gold/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-theme-gold-gradient flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Notifications</h2>
                <p className="text-xs sm:text-sm text-gray-600">Your account status & late arrivals</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-gold"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Account Status Section */}
                {staffStatus && (
                  <>
                    <h3 className="text-sm font-bold text-gray-700 mb-3">Account Status</h3>
                    <div className={`rounded-xl p-5 border-2 ${
                      staffStatus.status === 'approved' 
                        ? 'bg-green-50 border-green-300' 
                        : staffStatus.status === 'rejected'
                        ? 'bg-red-50 border-red-300'
                        : 'bg-blue-50 border-blue-300'
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        {staffStatus.status === 'approved' ? (
                          <CheckCircle className="w-8 h-8 text-green-600" />
                        ) : staffStatus.status === 'rejected' ? (
                          <XCircle className="w-8 h-8 text-red-600" />
                        ) : (
                          <Clock className="w-8 h-8 text-blue-600" />
                        )}
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {staffStatus.status === 'approved' 
                              ? 'Account Approved' 
                              : staffStatus.status === 'rejected'
                              ? 'Account Rejected'
                              : 'Pending Approval'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {staffStatus.status === 'approved' 
                              ? 'Your account has been approved by HOD' 
                              : staffStatus.status === 'rejected'
                              ? 'Your registration was not approved'
                              : 'Waiting for HOD approval'}
                          </p>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Department</p>
                          <p className="text-sm font-bold text-gray-900">{staffStatus.department}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Year</p>
                          <p className="text-sm font-bold text-gray-900">{staffStatus.year}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Section</p>
                          <p className="text-sm font-bold text-gray-900">{staffStatus.section}</p>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-600">
                          Requested: {new Date(staffStatus.createdAt).toLocaleDateString()} at{' '}
                          {new Date(staffStatus.createdAt).toLocaleTimeString()}
                        </p>
                        {staffStatus.processedAt && (
                          <p className="text-xs text-gray-600 mt-1">
                            {staffStatus.status === 'approved' ? 'Approved' : 'Rejected'}: {new Date(staffStatus.processedAt).toLocaleDateString()} at{' '}
                            {new Date(staffStatus.processedAt).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Info Message */}
                    {staffStatus.status === 'pending' && (
                      <div className="bg-blue-100 border border-blue-300 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          Your registration is under review. You will be notified once the HOD processes your request.
                        </p>
                      </div>
                    )}
                    {staffStatus.status === 'rejected' && (
                      <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                        <p className="text-sm text-red-800">
                          Please contact your HOD or administrator for more information.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Late Arrival Requests Section */}
                {requests.length > 0 && (
                  <>
                    <div className={staffStatus ? "mt-6 pt-4 border-t border-gray-200" : ""}>
                      <h3 className="text-sm font-bold text-gray-700 mb-3">Late Arrivals ({requests.length})</h3>
                      <div className="space-y-3">
                        {requests.map((request) => {
                          return (
                            <SwipeableCard
                              key={request._id}
                              actions={[
                                {
                                  label: 'Record',
                                  icon: <CheckCircle className="w-5 h-5" />,
                                  onClick: () => handleApprove(request),
                                  className: 'bg-green-600 hover:bg-green-700 text-white',
                                },
                              ]}
                            >
                              <div className="bg-gradient-to-br from-white to-amber-50 border-2 border-amber-200 rounded-lg p-3 hover:border-amber-400 transition-all">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="font-semibold text-gray-900">{request.data?.studentName}</p>
                                    <p className="text-xs text-gray-600">{request.data?.regNumber}</p>
                                  </div>
                                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">Late</span>
                                </div>
                                <p className="text-sm text-gray-700 mb-2"><strong>Reason:</strong> {request.data?.reason}</p>
                                <p className="text-xs text-gray-600 mb-3">
                                  Expected: {new Date(request.data?.expectedArrivalTime).toLocaleString()}
                                </p>
                                <p className="text-xs text-green-600 mb-3 font-semibold">👉 Student will confirm arrival in their dashboard</p>
                                {/* Desktop: Show Record button */}
                                <button
                                  onClick={() => handleApprove(request)}
                                  disabled={processing === request._id}
                                  className="hidden sm:flex w-full items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                                >
                                  {processing === request._id ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Recording...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4" />
                                      Record
                                    </>
                                  )}
                                </button>
                              </div>
                            </SwipeableCard>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}

                {!staffStatus && requests.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium">All set!</p>
                    <p className="text-sm text-gray-500 mt-1">No pending notifications</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )

    return ReactDOM.createPortal(modalContent, document.body)
  }

  // HOD View - Show pending requests from staff
  console.log('[NotificationRequests] Rendering with userRole:', userRole, 'requests count:', requests.length, 'loading:', loading)
  
  const modalContent = (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-theme-gold/10 to-theme-gold/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-theme-gold-gradient flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Requests</h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Staff signups & leave/late - {requests.length} pending {requests.length === 1 ? 'request' : 'requests'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-gold"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                <UserCheck className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">No pending requests</p>
              <p className="text-sm text-gray-500 mt-1">All requests have been processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const swipeActions = [
                  {
                    label: 'Reject',
                    icon: <UserX className="w-5 h-5" />,
                    onClick: () => handleReject(request),
                    className: 'bg-red-600 hover:bg-red-700 text-white',
                  },
                  {
                    label: 'Accept',
                    icon: <UserCheck className="w-5 h-5" />,
                    onClick: () => handleApprove(request),
                    className: 'bg-green-600 hover:bg-green-700 text-white',
                  },
                ]

                return (
                  <SwipeableCard
                    key={request._id}
                    actions={swipeActions}
                  >
                    <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-4 sm:p-5 hover:border-theme-gold/30 transition-all duration-200">
                      {/* Request Type Badge */}
                      <div className="mb-3 flex items-center justify-between">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          request.type === 'staff_account_approval' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {request.type === 'staff_account_approval' ? '👤 Staff Account' : '📋 Leave Request'}
                        </span>
                      </div>

                      {/* Staff Info (for staff account approval) */}
                      {request.type === 'staff_account_approval' && (
                        <div className="mb-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">
                                {request.data.staffName}
                              </h3>
                              <p className="text-sm text-gray-600 break-all">
                                {request.data.staffEmail}
                              </p>
                              {request.data.phoneNumber && (
                                <p className="text-sm text-gray-600 mt-1">
                                  📱 {request.data.phoneNumber}
                                </p>
                              )}
                            </div>
                            <div className="w-10 h-10 rounded-full bg-theme-gold-gradient flex items-center justify-center flex-shrink-0 ml-3">
                              <span className="text-white font-bold text-sm">
                                {request.data.staffName?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">Department</p>
                              <p className="text-xs sm:text-sm font-bold text-gray-900">
                                {request.data.department}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">Year</p>
                              <p className="text-xs sm:text-sm font-bold text-gray-900">
                                {request.data.year}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">Section</p>
                              <p className="text-xs sm:text-sm font-bold text-gray-900">
                                {request.data.section}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Leave Info (for leave requests) */}
                      {request.type === 'leave_request' && (
                        <div className="mb-4">
                          {/* Student Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                                {request.data.studentName || 'Unknown Student'}
                              </h3>
                              <div className="space-y-1 text-sm">
                                <p className="text-gray-600">
                                  <span className="text-gray-500">Reg:</span> {request.data.regNumber || '—'}
                                </p>
                                <p className="text-gray-600 capitalize">
                                  <span className="text-gray-500">Leave Type:</span> {request.data.type || '—'}
                                </p>
                              </div>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-orange-gradient flex items-center justify-center flex-shrink-0 ml-3">
                              <span className="text-white font-bold text-lg">
                                {request.data.studentName?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>

                          {/* Details Grid - 2x2 */}
                          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3">
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">Year</p>
                              <p className="text-sm font-bold text-gray-900">
                                {request.data.year || '—'}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">Section</p>
                              <p className="text-sm font-bold text-gray-900">
                                {request.data.section || '—'}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">From</p>
                              <p className="text-sm font-bold text-gray-900">
                                {request.data.startDate 
                                  ? new Date(request.data.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                                  : '—'}
                              </p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">To</p>
                              <p className="text-sm font-bold text-gray-900">
                                {request.data.endDate 
                                  ? new Date(request.data.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                                  : '—'}
                              </p>
                            </div>
                          </div>

                          {/* Reason */}
                          {request.data.reason && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200 mb-3">
                              <p className="text-xs text-gray-500 mb-1">Reason</p>
                              <p className="text-sm text-gray-700 line-clamp-2">
                                {request.data.reason}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-gray-500 mb-3">
                        Requested {new Date(request.createdAt).toLocaleDateString()} at{' '}
                        {new Date(request.createdAt).toLocaleTimeString()}
                      </p>

                      {/* Action Buttons (Desktop Only) */}
                      <div className="hidden sm:flex gap-2 sm:gap-3">
                        <button
                          onClick={() => handleApprove(request)}
                          disabled={processing === request._id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-all duration-200 text-sm sm:text-base"
                        >
                          <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span>{processing === request._id ? 'Processing...' : 'Accept'}</span>
                        </button>
                        <button
                          onClick={() => handleReject(request)}
                          disabled={processing === request._id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-all duration-200 text-sm sm:text-base"
                        >
                          <UserX className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span>{processing === request._id ? 'Processing...' : 'Reject'}</span>
                        </button>
                      </div>
                    </div>
                  </SwipeableCard>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return ReactDOM.createPortal(modalContent, document.body)
}
