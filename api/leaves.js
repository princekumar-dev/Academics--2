import { connectToDatabase } from '../lib/mongo.js'
import { LeaveRequest, Student, User } from '../models.js'
import { storeNotification } from '../lib/notificationService.js'
import { sendBroadcastNotification } from '../lib/broadcastNotification.js'
import { evolutionApi } from '../lib/evolutionApiService.js'

// Check Evolution API configuration
if (evolutionApi.isConfigured()) {
  console.log('✅ [leaves.js] Evolution API configured for WhatsApp notifications')
} else {
  console.warn('⚠️ [leaves.js] Evolution API not configured for WhatsApp notifications')
}

const normalizePhone = (num) => {
  if (!num) return null
  const cleaned = num.toString().replace(/[^0-9+]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.length === 10) return '+91' + cleaned
  return cleaned
}

// Build an absolute base URL for public access
const getBaseUrl = (req) => {
  const forwardedProto = (req.headers['x-forwarded-proto'] || '').split(',')[0]
  const proto = forwardedProto || req.protocol || 'http'
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host
  const envBase = process.env.PUBLIC_BASE_URL
  if (envBase) return envBase.replace(/\/$/, '')
  if (forwardedHost) return `${proto}://${forwardedHost}`
  return ''
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try { await connectToDatabase() } catch (err) {
    console.error('DB connect error (leaves):', err.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'POST') {
      const { action } = req.query
      if (action !== 'create') {
        return res.status(400).json({ success: false, error: 'Invalid action' })
      }

      const { type, regNumber, phoneNumber, reason, startDate, endDate, expectedArrivalTime } = req.body
      if (!type || !reason) {
        return res.status(400).json({ success: false, error: 'type and reason are required' })
      }
      if (!['leave','late'].includes(type)) {
        return res.status(400).json({ success: false, error: 'type must be leave or late' })
      }

      // Find student by regNumber or phone
      let student = null
      if (regNumber) student = await Student.findOne({ regNumber: regNumber })
      if (!student && phoneNumber) {
        student = await Student.findOne({ $or: [ { parentPhoneNumber: phoneNumber }, { studentPhoneNumber: phoneNumber } ] })
      }
      if (!student) {
        return res.status(404).json({ success: false, error: 'Student not found' })
      }

      console.log('[leaves] Creating request for student:', { name: student.name, regNumber: student.regNumber, department: student.department, type })
      const doc = new LeaveRequest({
        type,
        studentId: student._id,
        studentDetails: {
          name: student.name,
          regNumber: student.regNumber,
          year: student.year,
          section: student.section,
          department: student.department,
          parentPhoneNumber: normalizePhone(student.parentPhoneNumber)
        },
        reason,
      })
      if (type === 'leave') {
        if (!startDate || !endDate) {
          return res.status(400).json({ success: false, error: 'startDate and endDate are required for leave' })
        }
        doc.startDate = new Date(startDate)
        doc.endDate = new Date(endDate)
      } else {
        if (!expectedArrivalTime) {
          return res.status(400).json({ success: false, error: 'expectedArrivalTime is required for late' })
        }
        doc.expectedArrivalTime = new Date(expectedArrivalTime)
      }

      await doc.save()
      console.log('[leaves] Saved request:', { id: doc._id, type: doc.type, status: doc.status, department: doc.studentDetails.department })

      // Notify HOD or Staff
      if (type === 'leave') {
        const hod = await User.findOne({ role: 'hod', department: student.department }).lean()
        if (hod?.email) {
          await storeNotification({
            userEmail: hod.email,
            title: 'New Leave Request',
            body: `${student.name} (${student.regNumber}) requested leave`,
            data: { leaveId: doc._id.toString(), type: 'leave' }
          })
        }
      } else {
        const staff = await User.findOne({ role: 'staff', department: student.department, year: student.year, section: student.section }).lean()
        if (staff?.email) {
          await storeNotification({
            userEmail: staff.email,
            title: 'Late Arrival Notification',
            body: `${student.name} expects to arrive late`,
            data: { leaveId: doc._id.toString(), type: 'late' }
          })
        }
      }

      return res.status(201).json({ success: true, request: doc })
    }

    if (req.method === 'GET') {
      const { studentId, department, type, status } = req.query
      const filter = {}
      if (studentId) filter.studentId = studentId
      if (department) filter['studentDetails.department'] = department
      if (type) filter.type = type
      if (status) filter.status = status

      console.log('[leaves] GET query:', { filter, queryParams: req.query })
      const requests = await LeaveRequest.find(filter).sort({ createdAt: -1 }).lean()
      console.log('[leaves] Found requests:', requests.length)
      return res.status(200).json({ success: true, requests, filter })
    }

    if (req.method === 'PATCH') {
      const { id, action } = req.query
      console.log('🔍 [PATCH /api/leaves] Called with:', { id, action, body: req.body })
      
      if (!id) return res.status(400).json({ success: false, error: 'id is required' })
      const request = await LeaveRequest.findById(id)
      if (!request) return res.status(404).json({ success: false, error: 'Request not found' })

      console.log('🔍 [PATCH /api/leaves] Found request:', { 
        id: request._id, 
        type: request.type, 
        status: request.status,
        parentPhone: request.studentDetails?.parentPhoneNumber 
      })

      if (action === 'approve') {
        console.log('🔍 [PATCH /api/leaves] Processing approve action...')
        const { hodId } = req.body
        console.log('🔍 HOD ID from body:', hodId)
        
        const hod = hodId ? await User.findById(hodId) : null
        console.log('🔍 Found HOD:', hod ? { id: hod._id, name: hod.name } : 'NOT FOUND')
        
        if (!hod) return res.status(400).json({ success: false, error: 'Invalid HOD' })
        request.status = 'approved_by_hod'
        request.hodId = hod._id
        request.hodName = hod.name
        request.hodSignature = hod.eSignature || null
        request.approvedAt = new Date()
        await request.save()

        // Notify parent on WhatsApp with leave letter PDF attachment
        console.log('🔍 [Leave Approval] Starting WhatsApp dispatch via Evolution API...')
        console.log('🔍 Evolution API configured:', evolutionApi.isConfigured())
        console.log('🔍 Parent phone from request:', request.studentDetails?.parentPhoneNumber)
        
        if (evolutionApi.isConfigured()) {
          const parentPhone = request.studentDetails?.parentPhoneNumber
          console.log('🔍 Parent phone:', parentPhone)
          
          if (parentPhone) {
            // Build absolute PDF URL
            const baseUrl = getBaseUrl(req)
            console.log('🔍 Base URL:', baseUrl)
            
            const toAbsolute = (url) => {
              if (!url) return ''
              // If the url is already absolute, try to parse and return it.
              try {
                const parsed = new URL(url)
                // In production, disallow localhost/127.* URLs so remote services can't fetch them
                if (process.env.NODE_ENV === 'production' && (parsed.hostname.includes('localhost') || parsed.hostname.startsWith('127.'))) return ''
                return url
              } catch {
                if (!baseUrl) return ''
                const withSlash = url.startsWith('/') ? url : `/${url}`
                try {
                  const abs = new URL(`${baseUrl}${withSlash}`)
                  if (process.env.NODE_ENV === 'production' && (abs.hostname.includes('localhost') || abs.hostname.startsWith('127.'))) return ''
                  return abs.toString()
                } catch {
                  return ''
                }
              }
            }

            const leavePdfUrl = toAbsolute(`/api/generate-pdf?type=leave&leaveId=${request._id}`)
            const leaveImageUrl = toAbsolute(`/api/generate-pdf?type=leave&leaveId=${request._id}&format=jpeg`)

            // Format dates
            const startDateStr = new Date(request.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            const endDateStr = new Date(request.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

            // Build a compact message (PDF will be sent as a document attachment first)
            const message = `Hello! 📋

Your leave request for ${request.studentDetails.name} (Reg: ${request.studentDetails.regNumber}) has been approved.

📅 Leave Period: ${startDateStr} to ${endDateStr}
📝 Reason: ${request.reason}
✅ Status: Approved by HOD

The leave approval letter is attached to this message.

Best regards,
MSEC Academics Department`

            console.log('📄 Sending leave approval to:', parentPhone)
            console.log('📎 PDF URL:', leavePdfUrl || 'none')
            console.log('🖼️ Image URL:', leaveImageUrl || 'none')

            try {
              // If we have a publicly-accessible PDF URL, send it as a document first (keeps ordering consistent)
              if (leavePdfUrl) {
                try {
                  await evolutionApi.sendMediaMessage(parentPhone, leavePdfUrl, '', 'document')
                  console.log('✅ Leave PDF sent as document')
                } catch (docErr) {
                  console.warn('⚠️ Failed to send leave PDF as document:', docErr && docErr.message)
                }

                // Small delay to improve ordering
                await new Promise(r => setTimeout(r, 1200))
              } else if (leaveImageUrl) {
                // Fallback: send an image representation if PDF isn't accessible
                try {
                  await evolutionApi.sendMediaMessage(parentPhone, leaveImageUrl, `Leave Approval Letter - ${request.studentDetails.name}`, 'image')
                  console.log('✅ Leave image sent')
                } catch (imgErr) {
                  console.warn('⚠️ Failed to send leave image:', imgErr && imgErr.message)
                }
                await new Promise(r => setTimeout(r, 800))
              }

              // Send the textual notification after any media
              await evolutionApi.sendTextMessage(parentPhone, message)
              console.log('✅ Leave approval text sent successfully via Evolution API')
            } catch (err) {
              console.error('❌ WhatsApp send failed:', err && err.message)
              console.error('❌ Full error:', err)
            }
          } else {
            console.log('⚠️ No valid phone number to send to')
          }
        } else {
          console.log('⚠️ Evolution API not configured')
        }

        // Send broadcast notification for leave approval
        await sendBroadcastNotification(
          '✅ Leave Approved',
          `Leave request for ${request.studentDetails.name} has been approved`,
          {
            type: 'leave_approval',
            leaveId: request._id.toString(),
            studentName: request.studentDetails.name
          }
        )

        return res.status(200).json({ success: true, request })
      }

      if (action === 'reject') {
        request.status = 'rejected_by_hod'
        await request.save()
        
        // Send broadcast notification for leave rejection
        await sendBroadcastNotification(
          '❌ Leave Rejected',
          `Leave request for ${request.studentDetails.name} has been rejected`,
          {
            type: 'leave_approval',
            leaveId: request._id.toString(),
            studentName: request.studentDetails.name
          }
        )
        
        return res.status(200).json({ success: true, request })
      }

      if (action === 'acknowledge') {
        const { staffId } = req.body
        const staff = staffId ? await User.findById(staffId) : null
        if (!staff) return res.status(400).json({ success: false, error: 'Invalid staff' })
        
        // Step 1: Record button clicked - update status
        request.status = 'waiting_for_arrival_confirmation'
        request.staffId = staff._id
        request.staffName = staff.name
        request.recordedAt = new Date()
        await request.save()
        
        console.log(`✅ Late arrival recorded for student: ${request.studentDetails.name}`)

        // Send broadcast notification to trigger refresh on student's page
        await sendBroadcastNotification(
          '🔔 Late Arrival Recorded',
          `${staff.name} has recorded your late arrival. Please confirm in your dashboard.`,
          {
            type: 'late_arrival',
            leaveId: request._id.toString(),
            studentName: request.studentDetails.name
          }
        )

        return res.status(200).json({ success: true, request })
      }

      if (action === 'confirm-arrival') {
        // Step 2: Reached button clicked - confirm arrival and send notification
        // No staffId needed - student is confirming their own arrival
        console.log('🔍 [confirm-arrival] Processing for request:', request._id)
        console.log('🔍 [confirm-arrival] Current status:', request.status)
        
        // Verify the request is in the right state
        if (request.status !== 'waiting_for_arrival_confirmation') {
          console.warn('⚠️ [confirm-arrival] Invalid status. Expected waiting_for_arrival_confirmation, got:', request.status)
          return res.status(400).json({ success: false, error: `Cannot confirm arrival - request status is ${request.status}` })
        }
        
        request.status = 'acknowledged_by_staff'
        request.arrivalConfirmedAt = new Date()
        await request.save()
        console.log('✅ [confirm-arrival] Request saved successfully')

        // Send broadcast notification to trigger real-time updates on all open pages
        await sendBroadcastNotification(
          '🔔 Late Arrival Update',
          `${request.studentDetails.name} has confirmed their arrival`,
          {
            type: 'late_arrival',
            leaveId: request._id.toString(),
            studentName: request.studentDetails.name
          }
        )

        // Send WhatsApp notification to parent via Evolution API
        if (evolutionApi.isConfigured()) {
          try {
            const parentPhone = request.studentDetails?.parentPhoneNumber
            console.log('📱 [WhatsApp] Parent phone number:', parentPhone)
            
            if (!parentPhone) {
              console.warn('⚠️ [WhatsApp] No valid parent phone number found')
            } else {
              const timeStr = new Date(request.arrivalConfirmedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              const dateStr = new Date(request.arrivalConfirmedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              
              const text = `Hello! 🏫

This is to inform you that your ward *${request.studentDetails.name}* (Reg: ${request.studentDetails.regNumber}) has safely reached college.

🕐 Arrival Time: ${timeStr}
📅 Date: ${dateStr}
📝 Late Arrival Reason: ${request.reason}

The student has been marked present for today.

Thank you,
MSEC Academics Department`
              
              console.log('📤 [WhatsApp] Sending message via Evolution API...')
              console.log('   To:', parentPhone)
              
              await evolutionApi.sendTextMessage(parentPhone, text)
              
              console.log('✅ [WhatsApp] Late arrival confirmation sent successfully')
            }
          } catch (err) {
            console.error('❌ [WhatsApp] Failed to send message:', err.message)
            console.error('   Full error:', err)
          }
        } else {
          console.warn('⚠️ [WhatsApp] Evolution API not configured. Skipping WhatsApp dispatch.')
        }

        return res.status(200).json({ success: true, request })
      }

      return res.status(400).json({ success: false, error: 'Invalid action' })
    }

    if (req.method === 'DELETE') {
      const { id, action } = req.query
      console.log('🔍 [DELETE /api/leaves] Called with:', { id, action })
      
      if (!id) return res.status(400).json({ success: false, error: 'id is required' })
      
      const request = await LeaveRequest.findById(id)
      if (!request) return res.status(404).json({ success: false, error: 'Request not found' })

      if (action === 'delete' || !action) {
        // Only allow deletion of leave requests that are not yet approved
        const deletableStatuses = ['requested', 'waiting_for_arrival_confirmation', 'rejected_by_hod']
        
        if (!deletableStatuses.includes(request.status)) {
          return res.status(400).json({ success: false, error: `Cannot delete request with status: ${request.status}` })
        }

        await LeaveRequest.deleteOne({ _id: id })
        console.log('✅ [DELETE] Leave request deleted:', { id, type: request.type })
        
        // Send broadcast notification
        try {
          await sendBroadcastNotification(
            'Leave Request Deleted',
            `Your ${request.type} request has been deleted`,
            { type: 'leave_deleted', requestId: id }
          )
        } catch (err) {
          console.error('❌ Failed to send delete notification:', err.message)
        }

        return res.status(200).json({ success: true, message: 'Request deleted successfully' })
      }

      return res.status(400).json({ success: false, error: 'Invalid action' })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('❌ Leaves API error:', err.message)
    console.error('❌ Error stack:', err.stack)
    return res.status(500).json({ success: false, error: 'Internal server error', details: err.message })
  }
}
