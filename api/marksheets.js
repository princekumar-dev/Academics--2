import mongoose from 'mongoose'
import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet, Student, User } from '../models.js'
import { invalidatePdfCache } from './generate-pdf.js'
import multer from 'multer'
import webpush from 'web-push'
import { getUserSubscriptions, storeNotification } from '../lib/notificationService.js'
import { sendBroadcastNotification } from '../lib/broadcastNotification.js'

const PASS_MARK_THRESHOLD = 40

const getResultFromMarks = (marks) => (Number(marks) >= PASS_MARK_THRESHOLD ? 'Pass' : 'Fail')

const normalizeSubjectsWithResult = (subjects = []) => {
  return subjects.map((subject) => {
    const normalizedResult = ['Pass', 'Fail'].includes(subject?.result)
      ? subject.result
      : getResultFromMarks(subject?.marks)
    return {
      ...subject,
      result: normalizedResult
    }
  })
}

const getOverallResult = (subjects = []) => (
  subjects.length > 0 && subjects.every((sub) => sub.result === 'Pass') ? 'Pass' : 'Fail'
)

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in marksheets API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  // Configure web-push (align with notifications API)
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BI3ZQwdtuxxYpepMvZjy5xkuzLbnsjG8J1jfBkGMi0AzbhWDocIASZkq6ocisfwCTnYCHuogo_O-PJSuyfGWwkU'
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'hfn59n2ZF4qdGGl1kiuZ_zglStMTBIqN0CxC49jXUMc'
  try {
    webpush.setVapidDetails(
      'mailto:support@msecconnect.edu',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    )
  } catch {}

  async function sendUserNotification(userEmail, title, body, url = '/') {
    try {
      const { subscriptions } = await getUserSubscriptions(userEmail)
      const activeSubs = (subscriptions || []).filter(s => s.active === true || s.status === 'active')
      if (!activeSubs || activeSubs.length === 0) {
        // Still store the notification for inbox
        await storeNotification({ userEmail, title, body, url })
        return
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: '/images/android-chrome-192x192.png',
        badge: '/images/favicon-32x32.png',
        tag: 'msec-academics',
        data: { url }
      })

      await Promise.all(activeSubs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription, payload)
        } catch {}
      }))

      await storeNotification({ userEmail, title, body, url })
    } catch (e) {
      // Best-effort only
      try { await storeNotification({ userEmail, title, body, url }) } catch {}
    }
  }

  try {
    if (req.method === 'GET') {
  const { staffId, hodId, department, status, year: yearParam, includeAll, studentId, regNumber, phoneNumber } = req.query
      const rawId = req.query.marksheetId || req.query.id
      
      // Return single marksheet by id if requested
      if (rawId) {
        let one = null
        try {
          // Try Mongo _id lookup first
          one = await Marksheet.findById(rawId)
            .populate('staffId', 'name email department class')
            .populate('hodId', 'name email')
            .lean()
        } catch {}

        // If not found, try by business marksheetId (e.g., MS123...)
        if (!one) {
          one = await Marksheet.findOne({ marksheetId: rawId })
            .populate('staffId', 'name email department class')
            .populate('hodId', 'name email')
            .lean()
        }

        if (!one) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }
        return res.status(200).json({ success: true, marksheet: one })
      }

      let filter = {}
      let hodDept = null
      
      // Filter by staff ID
      if (staffId) {
        try {
          filter.staffId = new mongoose.Types.ObjectId(staffId)
        } catch {
          // Invalid ObjectId, skip filter
        }
      }

      // Filter by student id / reg / phone for student portal
      if (studentId) {
        try {
          filter.studentId = new mongoose.Types.ObjectId(studentId)
        } catch {
          filter['studentDetails._id'] = studentId
        }
      }
      if (regNumber) {
        filter['studentDetails.regNumber'] = regNumber
      }
      if (phoneNumber) {
        filter.$or = [
          { 'studentDetails.parentPhoneNumber': phoneNumber },
          { 'studentDetails.studentPhoneNumber': phoneNumber }
        ]
      }
      
      // Filter by HOD's department (pre-fetch if needed)
      if (hodId) {
        const hod = await User.findById(hodId).select('department').lean()
        if (hod) {
          hodDept = hod.department
          filter['studentDetails.department'] = hodDept
        }
      }
      
      // Filter by department
      if (department) {
        filter['studentDetails.department'] = department
        console.log(`[Marksheets API] Filtering by department: ${department}`)
      }
      
      // Filter by status (support comma-separated multiple statuses)
      // If includeAll is true, don't filter by status to get all marksheets
      if (status && !includeAll) {
        const statuses = status.split(',').map(s => s.trim())
        if (statuses.length === 1) {
          filter.status = status
        } else {
          filter.status = { $in: statuses }
        }
      }
      
      // Filter by year
      if (yearParam) {
        filter['studentDetails.year'] = yearParam
      }

      console.log('[Marksheets API] Filter:', JSON.stringify(filter))

      // Optimized query with field selection and limit
      const marksheets = await Marksheet.find(filter)
        .select('-__v') // Exclude version key
        .populate('staffId', 'name email department')
        .populate('hodId', 'name email')
        .sort({ createdAt: -1 })
        .limit(500) // Reasonable limit to prevent large payloads
        .lean()

      console.log(`[Marksheets API] Found ${marksheets.length} marksheets`)
      return res.status(200).json({ success: true, marksheets })
    }

    if (req.method === 'POST') {
      const { action } = req.query
      
      if (action === 'create') {
        const { 
          studentDetails, 
          examinationDate, 
          subjects, 
          staffId 
        } = req.body

        if (!studentDetails || !examinationDate || !subjects || !staffId) {
          return res.status(400).json({ 
            success: false, 
            error: 'studentDetails, examinationDate, subjects, and staffId are required' 
          })
        }

        // Get staff information
        const staff = await User.findById(staffId)
        if (!staff) {
          return res.status(404).json({ success: false, error: 'Staff not found' })
        }

        const normalizedSubjects = normalizeSubjectsWithResult(subjects)
        const overallResult = getOverallResult(normalizedSubjects)

        const marksheet = new Marksheet({
          studentDetails,
          examinationDate: new Date(examinationDate),
          subjects: normalizedSubjects,
          overallResult,
          staffId,
          staffName: staff.name,
          staffSignature: staff.eSignature
        })

        await marksheet.save()
        return res.status(201).json({ success: true, marksheet })
      }

      if (action === 'verify') {
        const { marksheetId, staffSignature } = req.body
        
        if (!marksheetId) {
          return res.status(400).json({ success: false, error: 'marksheetId is required' })
        }

        const marksheet = await Marksheet.findById(marksheetId)
        if (!marksheet) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }

        let staffDoc = null
        if (marksheet.staffId) {
          staffDoc = await User.findById(marksheet.staffId).select('name email department eSignature')
        }

        let resolvedSignature = typeof staffSignature === 'string' && staffSignature.trim().length > 0
          ? staffSignature
          : null

        if (!resolvedSignature) {
          resolvedSignature = staffDoc?.eSignature || null
        }

        if (!resolvedSignature) {
          return res.status(400).json({ success: false, error: 'Staff signature not available. Please upload your signature in Settings.' })
        }

        marksheet.status = 'verified_by_staff'
        marksheet.staffSignature = resolvedSignature
        marksheet.updatedAt = new Date()
        await marksheet.save()

        // Invalidate cached PDF so downloads reflect the new staff signature
        try { invalidatePdfCache(marksheet._id.toString()) } catch (e) {}

        // Notify HOD when all marksheets for the class are verified
        try {
          const staff = staffDoc || await User.findById(marksheet.staffId)
          const year = marksheet.studentDetails?.year
          const dept = marksheet.studentDetails?.department
          if (staff && year && dept) {
            const remainingDrafts = await Marksheet.countDocuments({
              'studentDetails.year': year,
              'studentDetails.department': dept,
              staffId: marksheet.staffId,
              status: { $in: ['draft'] }
            })
            if (remainingDrafts === 0) {
                // For first year, route verification notifications to HNS HOD
                const normalizedYear = String(year || '').toUpperCase().trim()
                const hodDeptToNotify = (normalizedYear === 'I') ? 'HNS' : dept
                const hod = await User.findOne({ role: 'hod', department: hodDeptToNotify })
                if (hod?.email) {
                  await sendUserNotification(
                    hod.email,
                    `Year ${year} marks verified`,
                    `All marksheets for ${dept} - Year ${year} have been verified by ${staff.name}.`,
                    '/approval-requests'
                  )
                }
              if (staff.email) {
                await sendUserNotification(
                  staff.email,
                  `Verification complete for Year ${year}`,
                  `You have verified all marksheets for ${dept} - Year ${year}. You can now request dispatch.`,
                  '/dispatch-requests'
                )
              }
            }
          }
        } catch {}

        return res.status(200).json({ success: true, marksheet })
      }

      if (action === 'mark-visited') {
        const { marksheetId } = req.body
        if (!marksheetId) {
          return res.status(400).json({ success: false, error: 'marksheetId is required' })
        }

        const marksheet = await Marksheet.findByIdAndUpdate(
          marksheetId,
          {
            visited: true,
            visitedAt: new Date(),
            updatedAt: new Date()
          },
          { new: true }
        )

        if (!marksheet) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }

        return res.status(200).json({ success: true, marksheet })
      }

      if (action === 'request-dispatch') {
        const { marksheetId, staffId } = req.body

        const staff = await User.findById(staffId)
        if (!staff) {
          return res.status(404).json({ success: false, error: 'Staff not found' })
        }

        // Load marksheet to determine student year/department so we can route to HNS for first year
        const existing = await Marksheet.findById(marksheetId).lean()
        if (!existing) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }

        const dept = existing.studentDetails?.department
        const year = existing.studentDetails?.year
        const normalizedYear = String(year || '').toUpperCase().trim()
        const hodDeptToNotify = (normalizedYear === 'I') ? 'HNS' : dept

        // Find HOD for the resolved department (HNS for first-year)
        let hod = null
        try {
          hod = await User.findOne({ role: 'hod', department: hodDeptToNotify })
        } catch (e) { hod = null }

        // Prepare update payload and include hodId/hodName if we found an HOD
        const updatePayload = {
          status: 'dispatch_requested',
          'dispatchRequest.requestedAt': new Date(),
          'dispatchRequest.requestedBy': staff.name,
          'dispatchRequest.status': 'pending',
          'dispatchRequest.hodResponse': null,
          'dispatchRequest.hodComments': null,
          'dispatchRequest.scheduledDispatchDate': null,
          'dispatchRequest.respondedAt': null,
          'dispatchRequest.preDispatchNotificationSent': false,
          'dispatchRequest.autoDispatched': false,
          'dispatchRequest.autoDispatchFailed': false,
          updatedAt: new Date()
        }

        if (hod) {
          updatePayload.hodId = hod._id
          updatePayload.hodName = hod.name
        }

        const marksheet = await Marksheet.findByIdAndUpdate(
          marksheetId,
          updatePayload,
          { new: true }
        )

        // Notify the selected HOD about new dispatch request
        try {
          if (hod?.email) {
            await sendUserNotification(
              hod.email,
              'New dispatch request',
              `${staff.name} requested dispatch for ${marksheet.studentDetails?.name} (${marksheet.studentDetails?.regNumber}).`,
              '/approval-requests'
            )
          } else {
            // Fallback: notify department HOD if HNS not found and it's not already the department hod
            const fallbackHod = await User.findOne({ role: 'hod', department: dept })
            if (fallbackHod?.email) {
              await sendUserNotification(
                fallbackHod.email,
                'New dispatch request',
                `${staff.name} requested dispatch for ${marksheet.studentDetails?.name} (${marksheet.studentDetails?.regNumber}).`,
                '/approval-requests'
              )
            }
          }
        } catch {}

        // Send broadcast notification for dispatch request
        await sendBroadcastNotification(
          '📤 Dispatch Request',
          `${staff.name} requested dispatch for ${marksheet.studentDetails?.name}`,
          {
            type: 'dispatch_request',
            marksheetId: marksheet._id.toString(),
            studentName: marksheet.studentDetails?.name
          }
        )

        return res.status(200).json({ success: true, marksheet })
      }

      if (action === 'hod-response') {
        const { marksheetId, hodId, response, comments } = req.body
        
        const hod = await User.findById(hodId)
        if (!hod) {
          return res.status(404).json({ success: false, error: 'HOD not found' })
        }

        const normalizedResponse = (response || '').toLowerCase()
        const allowedResponses = ['approved', 'rejected']
        if (!allowedResponses.includes(normalizedResponse)) {
          return res.status(400).json({ success: false, error: 'Invalid response type' })
        }

        let statusUpdate = 'dispatch_requested'
        if (normalizedResponse === 'approved') statusUpdate = 'approved_by_hod'
        if (normalizedResponse === 'rejected') statusUpdate = 'rejected_by_hod'

        const updateData = {
          status: statusUpdate,
          hodId,
          hodName: hod.name,
          hodSignature: hod.eSignature,
          'dispatchRequest.status': normalizedResponse,
          'dispatchRequest.hodResponse': normalizedResponse,
          'dispatchRequest.hodComments': comments,
          'dispatchRequest.respondedAt': new Date(),
          'dispatchRequest.preDispatchNotificationSent': false,
          'dispatchRequest.autoDispatched': false,
          'dispatchRequest.autoDispatchFailed': false,
          'dispatchRequest.dispatchError': null,
          'dispatchRequest.scheduledDispatchDate': null,
          updatedAt: new Date()
        }

        const marksheet = await Marksheet.findByIdAndUpdate(
          marksheetId,
          updateData,
          { new: true }
        )

        if (!marksheet) {
          return res.status(404).json({ success: false, error: 'Marksheet not found' })
        }
        // Invalidate cached PDF so downloads reflect the new HOD signature/status
        try { invalidatePdfCache(marksheet._id.toString()) } catch (e) {}
        // Notify staff about HOD response
        try {
          const staff = await User.findById(marksheet.staffId)
          if (staff?.email) {
            if (normalizedResponse === 'approved') {
              await sendUserNotification(
                staff.email,
                'Dispatch approved by HOD',
                `Your dispatch request for ${marksheet.studentDetails?.name} has been approved.`,
                '/dispatch-requests'
              )
            } else if (normalizedResponse === 'rejected') {
              await sendUserNotification(
                staff.email,
                'Dispatch rejected by HOD',
                `Your dispatch request for ${marksheet.studentDetails?.name} was rejected. Comments: ${comments || 'N/A'}.`,
                '/dispatch-requests'
              )
            }
          }
        } catch {}

        // Send broadcast notification for HOD response
        await sendBroadcastNotification(
          normalizedResponse === 'approved' ? '✅ Dispatch Approved' : '❌ Dispatch Rejected',
          `Dispatch request for ${marksheet.studentDetails?.name} has been ${normalizedResponse}`,
          {
            type: 'marksheet_approval',
            marksheetId: marksheet._id.toString(),
            studentName: marksheet.studentDetails?.name,
            response: normalizedResponse
          }
        )

        return res.status(200).json({ success: true, marksheet })
      }

      return res.status(400).json({ success: false, error: 'Invalid action' })
    }

    if (req.method === 'DELETE') {
      const { marksheetId } = req.body
      
      if (!marksheetId) {
        return res.status(400).json({ success: false, error: 'marksheetId is required' })
      }

      const deleted = await Marksheet.findByIdAndDelete(marksheetId)
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Marksheet not found' })
      }

      return res.status(200).json({ success: true, deleted: true })
    }

    if (req.method === 'PUT') {
      const { marksheetId, studentDetails, subjects } = req.body
      const { regenerateSignatures, recomputeResults } = req.body || {}

      if (!marksheetId) {
        return res.status(400).json({ success: false, error: 'marksheetId is required' })
      }

      const update = { updatedAt: new Date() }

      if (studentDetails && typeof studentDetails === 'object') {
        for (const key of ['name','regNumber','class','section','department','parentPhoneNumber']) {
          if (studentDetails[key] !== undefined) {
            update[`studentDetails.${key}`] = studentDetails[key]
          }
        }
      }

      if (Array.isArray(subjects) && subjects.length > 0) {
        const normalizedSubjects = normalizeSubjectsWithResult(subjects)
        update.subjects = normalizedSubjects
        update.overallResult = getOverallResult(normalizedSubjects)
        // If edited, move back to draft until verified again
        update.status = 'draft'
      }

      // If requested, refresh staff/hod signatures from current user profiles
      if (regenerateSignatures) {
        try {
          const existing = await Marksheet.findById(marksheetId).lean()
          if (existing) {
            if (existing.staffId) {
              try {
                const staff = await User.findById(existing.staffId).select('eSignature').lean()
                if (staff && staff.eSignature) update.staffSignature = staff.eSignature
              } catch (e) {}
            }
            if (existing.hodId) {
              try {
                const hod = await User.findById(existing.hodId).select('eSignature').lean()
                if (hod && hod.eSignature) update.hodSignature = hod.eSignature
              } catch (e) {}
            }
          }
        } catch (e) {
          console.error('[Marksheets API] regenerateSignatures lookup failed:', e && e.message)
        }
      }

      // If requested, recompute subject results/overallResult from stored subjects
      if (recomputeResults) {
        try {
          const existing = await Marksheet.findById(marksheetId).lean()
          if (existing && Array.isArray(existing.subjects)) {
            const normalized = normalizeSubjectsWithResult(existing.subjects || [])
            update.subjects = normalized
            update.overallResult = getOverallResult(normalized)
          }
        } catch (e) {
          console.error('[Marksheets API] recomputeResults failed:', e && e.message)
        }
      }

      const marksheet = await Marksheet.findByIdAndUpdate(
        marksheetId,
        update,
        { new: true }
      )

      if (!marksheet) {
        return res.status(404).json({ success: false, error: 'Marksheet not found' })
      }

      // If regenerate requested or signature fields changed, invalidate cached PDF
      try { invalidatePdfCache(marksheet._id.toString()) } catch (e) {}

      return res.status(200).json({ success: true, marksheet })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
    
  } catch (err) {
    console.error('Marksheets API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
