import { connectToDatabase } from '../lib/mongo.js'
import { User, StaffApprovalRequest } from '../models.js'
import bcrypt from 'bcryptjs'
import { storeNotification, getUserSubscriptions } from '../lib/notificationService.js'
import webpush from 'web-push'

// Configure web-push VAPID
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BI3ZQwdtuxxYpepMvZjy5xkuzLbnsjG8J1jfBkGMi0AzbhWDocIASZkq6ocisfwCTnYCHuogo_O-PJSuyfGWwkU'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'hfn59n2ZF4qdGGl1kiuZ_zglStMTBIqN0CxC49jXUMc'
webpush.setVapidDetails('mailto:support@msecconnect.edu', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in staff-approval API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    // GET - Fetch pending staff approval requests for HOD
    if (req.method === 'GET') {
      const { action, hodId } = req.query
      console.log('[staff-approval GET] action:', action, 'hodId:', hodId)

      if (action === 'pending' && hodId) {
        console.log('[staff-approval GET] Searching for pending requests with hodId:', hodId)
        
        // Get all pending requests for this HOD
        const requests = await StaffApprovalRequest.find({
          approvalHodId: hodId, // MongoDB will auto-convert string to ObjectId for comparison
          status: 'pending'
        }).sort({ createdAt: -1 }).lean()

        console.log('[staff-approval GET] Found', requests.length, 'pending requests')
        
        if (requests.length > 0) {
          console.log('[staff-approval GET] First request:', JSON.stringify(requests[0]))
        }

        return res.status(200).json({
          success: true,
          requests: requests.map(r => ({
            id: r._id.toString(),
            email: r.email,
            name: r.name,
            department: r.department,
            year: r.year,
            section: r.section,
            phoneNumber: r.phoneNumber,
            status: r.status,
            createdAt: r.createdAt
          }))
        })
      }

      if (action === 'details' && req.query.requestId) {
        const request = await StaffApprovalRequest.findById(req.query.requestId).lean()
        if (!request) {
          return res.status(404).json({ success: false, error: 'Request not found' })
        }

        return res.status(200).json({
          success: true,
          request: {
            id: request._id,
            email: request.email,
            name: request.name,
            department: request.department,
            year: request.year,
            section: request.section,
            phoneNumber: request.phoneNumber,
            status: request.status,
            createdAt: request.createdAt
          }
        })
      }

      return res.status(400).json({ success: false, error: 'Invalid query parameters' })
    }

    // PATCH - HOD approves or rejects a staff request
    if (req.method === 'PATCH') {
      const { requestId, action, hodId, rejectionReason } = req.body

      if (!requestId || !action || !hodId) {
        return res.status(400).json({ success: false, error: 'requestId, action, and hodId are required' })
      }

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, error: 'action must be either approve or reject' })
      }

      // Verify the HOD is authorized to approve this request
      const approvalRequest = await StaffApprovalRequest.findById(requestId)
      if (!approvalRequest) {
        return res.status(404).json({ success: false, error: 'Request not found' })
      }

      if (approvalRequest.approvalHodId.toString() !== hodId) {
        return res.status(403).json({ success: false, error: 'You are not authorized to approve this request' })
      }

      if (approvalRequest.status !== 'pending') {
        return res.status(400).json({ success: false, error: `This request has already been ${approvalRequest.status}` })
      }

      const hod = await User.findById(hodId)
      if (!hod) {
        return res.status(404).json({ success: false, error: 'HOD not found' })
      }

      if (action === 'approve') {
        try {
          // Create the staff user account
          const staffUser = new User({
            email: approvalRequest.email,
            password: approvalRequest.password, // Already hashed
            name: approvalRequest.name,
            role: 'staff',
            department: approvalRequest.department,
            year: approvalRequest.year,
            section: approvalRequest.section,
            phoneNumber: approvalRequest.phoneNumber
          })

          await staffUser.save()

          // Update the approval request status
          approvalRequest.status = 'approved'
          approvalRequest.approvedBy = hod._id
          approvalRequest.approvedAt = new Date()
          await approvalRequest.save()

          // Send notification to staff - account approved
          try {
            const staffNotification = {
              userEmail: approvalRequest.email,
              type: 'staff_account_approved',
              title: '✅ Account Approved!',
              body: `Your staff account has been approved by ${hod.name}. You can now log in with your credentials.`,
              data: {
                requestId: approvalRequest._id.toString(),
                status: 'approved'
              },
              read: false,
              createdAt: new Date()
            }

            await storeNotification(staffNotification)
              try {
                const { subscriptions } = await getUserSubscriptions(approvalRequest.email)
                const activeSubs = (subscriptions || []).filter(s => s.active === true || s.status === 'active')
                if (activeSubs && activeSubs.length > 0) {
                  const payload = JSON.stringify({
                    title: staffNotification.title,
                    body: staffNotification.body,
                    icon: '/images/android-chrome-192x192.png',
                    badge: '/images/favicon-32x32.png',
                    tag: 'msec-academics',
                    data: { type: staffNotification.type, ...staffNotification.data }
                  })
                  await Promise.all(activeSubs.map(async (sub) => {
                    try {
                      await webpush.sendNotification(sub.subscription, payload)
                    } catch (e) {
                      // non-fatal
                    }
                  }))
                }
              } catch (pushErr) {
                // ignore push errors
              }
          } catch (err) {
            console.error('Error sending staff approval notification:', err)
          }

          return res.status(200).json({
            success: true,
            message: `Staff account for ${approvalRequest.name} has been approved`,
            userId: staffUser._id
          })
        } catch (createErr) {
          if (createErr.code === 11000) {
            // Duplicate email
            return res.status(409).json({ success: false, error: 'Email already exists' })
          }
          console.error('Error creating staff user:', createErr)
          return res.status(500).json({ success: false, error: 'Failed to create staff account' })
        }
      }

      if (action === 'reject') {
        try {
          const reason = rejectionReason || 'No reason provided'

          // Update the approval request status
          approvalRequest.status = 'rejected'
          approvalRequest.rejectionReason = reason
          approvalRequest.rejectedAt = new Date()
          await approvalRequest.save()

          // Send notification to staff - account rejected
          try {
            const staffNotification = {
              userEmail: approvalRequest.email,
              type: 'staff_account_rejected',
              title: '❌ Account Request Rejected',
              body: `Your staff account request has been rejected by ${hod.name}. Reason: ${reason}`,
              data: {
                requestId: approvalRequest._id.toString(),
                status: 'rejected',
                reason: reason
              },
              read: false,
              createdAt: new Date()
            }

            await storeNotification(staffNotification)
            try {
              const { subscriptions } = await getUserSubscriptions(approvalRequest.email)
              const activeSubs = (subscriptions || []).filter(s => s.active === true || s.status === 'active')
              if (activeSubs && activeSubs.length > 0) {
                const payload = JSON.stringify({
                  title: staffNotification.title,
                  body: staffNotification.body,
                  icon: '/images/android-chrome-192x192.png',
                  badge: '/images/favicon-32x32.png',
                  tag: 'msec-academics',
                  data: { type: staffNotification.type, ...staffNotification.data }
                })
                await Promise.all(activeSubs.map(async (sub) => {
                  try {
                    await webpush.sendNotification(sub.subscription, payload)
                  } catch (e) {
                    // ignore
                  }
                }))
              }
            } catch (pushErr) {
              // ignore
            }
          } catch (err) {
            console.error('Error sending staff rejection notification:', err)
          }

          return res.status(200).json({
            success: true,
            message: `Staff account request for ${approvalRequest.name} has been rejected`
          })
        } catch (rejectErr) {
          console.error('Error rejecting staff account:', rejectErr)
          return res.status(500).json({ success: false, error: 'Failed to reject account request' })
        }
      }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('Staff approval API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
