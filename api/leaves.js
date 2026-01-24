import { connectToDatabase } from '../lib/mongo.js'
import { LeaveRequest, Student, User } from '../models.js'
import { storeNotification } from '../lib/notificationService.js'
import { sendBroadcastNotification } from '../lib/broadcastNotification.js'
import { evolutionApi } from '../lib/evolutionApiService.js'
import axios from 'axios'
import { generateLeavePDF } from './generate-pdf.js'

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
  // Priority:
  // 1) explicit PUBLIC_BASE_URL
  // 2) forwarded host from request (x-forwarded-host or host) — use this to reflect the client's URL
  // 3) VERCEL_URL env
  // 4) fallback to empty string
  // Prefer the host the client used (x-forwarded-host or host header).
  // This ensures the generated public URL matches the URL the user visited.
  const forwardedProto = (req.headers['x-forwarded-proto'] || '').split(',')[0]
  const proto = forwardedProto || req.protocol || 'https'
  const forwardedHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString()
  if (forwardedHost) {
    console.log('🔗 getBaseUrl -> using forwarded host from request headers ->', `${proto}://${forwardedHost.replace(/\/$/, '')}`)
    return `${proto}://${forwardedHost.replace(/\/$/, '')}`
  }

  const envBase = process.env.PUBLIC_BASE_URL
  if (envBase) {
    console.log('🔗 getBaseUrl -> using PUBLIC_BASE_URL ->', envBase.replace(/\/$/, ''))
    return envBase.replace(/\/$/, '')
  }

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) {
    console.log('🔗 getBaseUrl -> using VERCEL_URL ->', `https://${vercelUrl.replace(/\/$/, '')}`)
    return `https://${vercelUrl.replace(/\/$/, '')}`
  }

  console.warn('🔗 getBaseUrl -> no base URL available')
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
        
        // Track WhatsApp send result so it can be returned to caller and logged
        let whatsappResult = { sentPdf: false, sentImage: false, sentText: false, pdfMessageId: null, textMessageId: null, errors: [] }

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

            // Build a compact message. PDF will be sent as a document attachment first
            const message = `Hello! 📋

Your leave request for ${request.studentDetails.name} (Reg: ${request.studentDetails.regNumber}) has been approved.

📅 Leave Period: ${startDateStr} to ${endDateStr}
📝 Reason: ${request.reason}
✅ Status: Approved by HOD

The leave approval letter is attached to the previous message. Download: ${leavePdfUrl || leaveImageUrl || 'Not available'}

Best regards,
MSEC Academics Department`

            console.log('📄 Sending leave approval to:', parentPhone)
            console.log('📎 PDF URL:', leavePdfUrl || 'none')
            console.log('🖼️ Image URL:', leaveImageUrl || 'none')

            try {
              // If we have a publicly-accessible PDF URL, send it as a document first (keeps ordering consistent)
              if (leavePdfUrl) {
                // First attempt: generate the PDF server-side and send as data URL to Evolution
                try {
                  const pdfBuf = await generateLeavePDF(request.toObject ? request.toObject() : request)
                  if (pdfBuf && pdfBuf.length) {
                    const dataUrl = `data:application/pdf;base64,${pdfBuf.toString('base64')}`
                    try {
                      const mediaResp = await evolutionApi.sendMediaMessage(parentPhone, dataUrl, '', 'document', 'leave-letter.pdf')
                      if (mediaResp && mediaResp.success) {
                        whatsappResult.sentPdf = true
                        whatsappResult.pdfMessageId = mediaResp.messageId || null
                        console.log('✅ Leave PDF generated server-side and sent via Evolution -> messageId=', whatsappResult.pdfMessageId)
                      } else {
                        whatsappResult.errors.push('sendMediaMessage(dataUrl) returned no success')
                      }
                    } catch (sendErr) {
                      const msg = sendErr && (sendErr.message || JSON.stringify(sendErr))
                      whatsappResult.errors.push(`sendMediaMessage(dataUrl) failed: ${msg}`)
                      console.warn('⚠️ sendMediaMessage(dataUrl) failed:', msg)
                    }
                  } else {
                    whatsappResult.errors.push('generateLeavePDF returned empty buffer')
                    console.warn('⚠️ generateLeavePDF returned empty buffer')
                  }
                } catch (genErr) {
                  const msg = genErr && (genErr.message || JSON.stringify(genErr))
                  whatsappResult.errors.push(`Server-side PDF generation failed: ${msg}`)
                  console.warn('⚠️ Server-side generation of leave PDF failed:', msg)
                }

                // If server-side data URL send didn't work, try the remote-URL approach with retries
                if (!whatsappResult.sentPdf) {
                  // Check that the remote URL is reachable before telling Evolution to fetch it.
                  // This avoids Evolution returning 500 when our host is not resolvable.
                  let remoteReachable = true
                  try {
                    if (!leavePdfUrl || !leavePdfUrl.startsWith('http')) {
                      remoteReachable = false
                      whatsappResult.errors.push('leavePdfUrl is not a valid http(s) URL')
                      console.warn('⚠️ leavePdfUrl is not http(s):', leavePdfUrl)
                    } else {
                      // First try a HEAD request with a short timeout
                      try {
                        const headResp = await axios.head(leavePdfUrl, { timeout: 3000, maxRedirects: 2 })
                        if (!headResp || headResp.status >= 400) {
                          // treat 4xx/5xx as unreachable
                          remoteReachable = false
                          whatsappResult.errors.push(`leavePdfUrl not reachable (status=${headResp && headResp.status})`)
                          console.warn('⚠️ leavePdfUrl HEAD returned status:', headResp && headResp.status)
                        }
                      } catch (headErr) {
                        // Some servers/proxies reject HEAD (405). Try a lightweight GET for first byte using Range.
                        const headMsg = headErr && (headErr.message || JSON.stringify(headErr))
                        console.warn('⚠️ leavePdfUrl HEAD failed, trying GET with Range (may be 405):', headMsg)
                        try {
                          const getResp = await axios.get(leavePdfUrl, { timeout: 3000, maxRedirects: 2, headers: { Range: 'bytes=0-0' }, validateStatus: status => true })
                          // Accept 200 OK (server ignored range), 206 Partial Content, and 3xx redirects as reachable
                          if (![200, 206].includes(getResp.status) && !(getResp.status >= 300 && getResp.status < 400)) {
                            remoteReachable = false
                            whatsappResult.errors.push(`leavePdfUrl not reachable (status=${getResp.status})`)
                            console.warn('⚠️ leavePdfUrl GET (range) returned status:', getResp.status)
                          }
                        } catch (getErr) {
                          remoteReachable = false
                          const msg = getErr && (getErr.message || JSON.stringify(getErr))
                          whatsappResult.errors.push(`leavePdfUrl unreachable (GET with Range): ${msg}`)
                          console.warn('⚠️ leavePdfUrl GET (range) failed:', msg)
                        }
                      }
                    }
                  } catch (reachErr) {
                    remoteReachable = false
                    const msg = reachErr && (reachErr.message || JSON.stringify(reachErr))
                    whatsappResult.errors.push(`leavePdfUrl unreachable: ${msg}`)
                    console.warn('⚠️ leavePdfUrl reachability check failed:', msg)
                  }

                  if (remoteReachable) {
                    const maxAttempts = 3
                    let attempt = 0
                    while (attempt < maxAttempts && !whatsappResult.sentPdf) {
                      attempt++
                      try {
                        const mediaResp = await evolutionApi.sendMediaMessage(parentPhone, leavePdfUrl, '', 'document', 'leave-letter.pdf')
                        if (mediaResp && mediaResp.success) {
                          whatsappResult.sentPdf = true
                          whatsappResult.pdfMessageId = mediaResp.messageId || null
                          console.log(`✅ Leave PDF sent as document (attempt ${attempt}) -> messageId=${whatsappResult.pdfMessageId}`)
                          break
                        } else {
                          whatsappResult.errors.push(`sendMediaMessage returned no success on attempt ${attempt}`)
                        }
                      } catch (docErr) {
                        const msg = docErr && (docErr.message || JSON.stringify(docErr))
                        whatsappResult.errors.push(`PDF send attempt ${attempt} failed: ${msg}`)
                        console.warn(`⚠️ PDF send attempt ${attempt} failed:`, msg)
                        if (docErr && docErr.response) {
                          try { whatsappResult.errors.push(JSON.stringify(docErr.response.data)) } catch(e) {}
                          console.warn('   Evolution response status:', docErr.response.status)
                          console.warn('   Evolution response data:', JSON.stringify(docErr.response.data))
                        }
                        await new Promise(r => setTimeout(r, 800 * attempt))
                      }
                    }
                  } else {
                    console.warn('⚠️ Skipping remote PDF send because URL is unreachable')
                  }
                }
              }

              // If PDF wasn't sent and image URL available, try sending image
              if (!whatsappResult.sentPdf && leaveImageUrl) {
                try {
                  const imgResp = await evolutionApi.sendMediaMessage(parentPhone, leaveImageUrl, '', 'image')
                  if (imgResp && imgResp.success) {
                    whatsappResult.sentImage = true
                    whatsappResult.pdfMessageId = imgResp.messageId || null
                    console.log('✅ Leave image sent as fallback -> messageId=', whatsappResult.pdfMessageId)
                  } else {
                    whatsappResult.errors.push('sendMediaMessage(image) returned no success')
                  }
                } catch (imgErr) {
                  const msg = imgErr && (imgErr.message || JSON.stringify(imgErr))
                  whatsappResult.errors.push(`Image send failed: ${msg}`)
                  console.warn('⚠️ Failed to send leave image fallback:', msg)
                }
              }

              // Small delay to improve ordering whether or not media was sent
              await new Promise(r => setTimeout(r, 1200))

              // Send the textual notification after any media. Include a download link
              try {
                const textResp = await evolutionApi.sendTextMessage(parentPhone, message)
                whatsappResult.sentText = true
                whatsappResult.textMessageId = textResp?.messageId || null
                console.log('✅ Leave approval text sent successfully via Evolution API -> messageId=', whatsappResult.textMessageId)
              } catch (textErr) {
                const msg = textErr && (textErr.message || JSON.stringify(textErr))
                whatsappResult.errors.push(`Text send failed: ${msg}`)
                console.warn('⚠️ Failed to send leave approval text message:', msg)
                if (textErr && textErr.response) {
                  try { whatsappResult.errors.push(JSON.stringify(textErr.response.data)) } catch(e) {}
                }
              }
            } catch (err) {
              const msg = err && (err.message || JSON.stringify(err))
              whatsappResult.errors.push(`Unexpected failure: ${msg}`)
              console.error('❌ WhatsApp send unexpected failure:', msg)
            }

            // Notify HOD (sender) about the WhatsApp dispatch result, if HOD exists
            try {
              if (hod?.email) {
                const title = whatsappResult.sentText || whatsappResult.sentPdf
                  ? '✅ Leave Sent via WhatsApp'
                  : '⚠️ Leave WhatsApp Dispatch Failed'
                const bodyLines = []
                if (whatsappResult.sentPdf) bodyLines.push('Leave PDF sent to parent via WhatsApp')
                if (whatsappResult.sentImage) bodyLines.push('Leave image sent to parent via WhatsApp (fallback)')
                if (whatsappResult.sentText) bodyLines.push('Follow-up text message sent')
                if (whatsappResult.errors.length > 0) bodyLines.push(`Errors: ${whatsappResult.errors.slice(0,3).join(' | ')}`)

                await storeNotification({
                  userEmail: hod.email,
                  title,
                  body: bodyLines.join('\n'),
                  data: { leaveId: request._id.toString(), whatsappResult }
                })

                try {
                  await sendBroadcastNotification(title, bodyLines.join(' \n '), { type: 'leave_whatsapp', leaveId: request._id.toString() })
                } catch (bErr) {
                  // ignore
                }
              }
            } catch (notifyErr) {
              console.warn('⚠️ Failed to notify HOD about WhatsApp dispatch result:', notifyErr && notifyErr.message)
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

        return res.status(200).json({ success: true, request, whatsappResult })
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
