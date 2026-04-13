import { connectToDatabase } from '../lib/mongo.js'
import { User, Student, StaffApprovalRequest, AccessPolicy, EmailVerification } from '../models.js'
import bcrypt from 'bcryptjs'
import { storeNotification, getUserSubscriptions } from '../lib/notificationService.js'
import webpush from 'web-push'
import { consumeVerificationToken, normalizeEmail, generateOtpCode, createVerificationRequest, verifyOtpCode } from '../lib/emailVerification.js'
import { sendVerificationCodeEmail } from '../lib/emailService.js'

const DEFAULT_START_MINUTES = 8 * 60 + 30
const DEFAULT_END_MINUTES = 17 * 60
const ACCESS_POLICY_KEY = 'login_window'
const ALLOWED_VERIFICATION_PURPOSES = new Set(['signup', 'login'])
const RATE_WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS_PER_EMAIL = 3
const MAX_REQUESTS_PER_IP = 20

const getRequestIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  if (Array.isArray(forwarded)) return forwarded[0]
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || req.ip || 'unknown'
}

const isMsecEmail = (email) => normalizeEmail(email).endsWith('@msec.edu.in')

const clampMinute = (value, fallback) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(23 * 60 + 59, Math.floor(n)))
}

const timeStringToMinutes = (timeString, fallback) => {
  const input = String(timeString || '').trim()
  const match = input.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return fallback

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback

  return hour * 60 + minute
}

const minutesToTimeString = (minutes) => {
  const safe = clampMinute(minutes, DEFAULT_START_MINUTES)
  const hour = Math.floor(safe / 60)
  const minute = safe % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const ensurePolicy = async () => {
  let policy = await AccessPolicy.findOne({ key: ACCESS_POLICY_KEY })
  if (policy) return policy

  policy = new AccessPolicy({
    key: ACCESS_POLICY_KEY,
    staffHodWindowStart: DEFAULT_START_MINUTES,
    staffHodWindowEnd: DEFAULT_END_MINUTES,
    enforceForStaffHod: true
  })
  await policy.save()
  return policy
}

const toResponsePolicy = (policy) => {
  const start = clampMinute(policy?.staffHodWindowStart, DEFAULT_START_MINUTES)
  const end = clampMinute(policy?.staffHodWindowEnd, DEFAULT_END_MINUTES)

  return {
    key: ACCESS_POLICY_KEY,
    staffHodWindowStart: start,
    staffHodWindowEnd: end,
    staffHodWindowStartTime: minutesToTimeString(start),
    staffHodWindowEndTime: minutesToTimeString(end),
    enforceForStaffHod: Boolean(policy?.enforceForStaffHod),
    updatedAt: policy?.updatedAt || null,
    updatedByUserId: policy?.updatedByUserId || null
  }
}

// Configure web-push VAPID
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BI3ZQwdtuxxYpepMvZjy5xkuzLbnsjG8J1jfBkGMi0AzbhWDocIASZkq6ocisfwCTnYCHuogo_O-PJSuyfGWwkU'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'hfn59n2ZF4qdGGl1kiuZ_zglStMTBIqN0CxC49jXUMc'
webpush.setVapidDetails('mailto:support@msecconnect.edu', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in users API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'GET') {
      const { action, userId, studentPhoneNumber, regNumber } = req.query

      if (action === 'access-policy') {
        const policy = await ensurePolicy()
        return res.status(200).json({ success: true, policy: toResponsePolicy(policy) })
      }

      // Get student by reg number or phone number. Prefer regNumber when provided
      // to avoid ambiguous matches when multiple students share a parent phone.
      if (regNumber || studentPhoneNumber) {
        let student = null

        // If regNumber is provided, prefer exact regNumber match
        if (regNumber) {
          student = await Student.findOne({ regNumber: regNumber }).lean()
        }

        // If not found by regNumber and phone provided, fallback to phone lookup
        if (!student && studentPhoneNumber) {
          const query = { $or: [] }
          query.$or.push({ parentPhoneNumber: studentPhoneNumber })
          query.$or.push({ studentPhoneNumber: studentPhoneNumber })
          student = await Student.findOne(query).lean()
        }

        if (!student) {
          return res.status(404).json({ success: false, error: 'Student not found' })
        }

        return res.status(200).json({
          success: true,
          user: {
            id: student._id,
            name: student.name,
            regNumber: student.regNumber,
            year: student.year,
            section: student.section,
            department: student.department,
            parentPhoneNumber: student.parentPhoneNumber,
            studentPhoneNumber: student.studentPhoneNumber,
            role: 'student'
          }
        })
      }

      if (action === 'profile') {
        if (!userId) {
          return res.status(400).json({ success: false, error: 'userId is required' })
        }

        // Select only needed fields for faster query
        const user = await User.findById(userId).select('_id name email role department year section phoneNumber eSignature').lean()
        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found' })
        }

        return res.status(200).json({
          success: true,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            year: user.year,
            section: user.section,
            phoneNumber: user.phoneNumber,
            eSignature: user.eSignature
          }
        })
      }

      // list users for academic system - select only needed fields
      const users = await User.find().select('_id name email role department year section phoneNumber').sort({ createdAt: -1 }).lean()
      // Remove sensitive fields before sending to client
      const safe = users.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        year: u.year,
        section: u.section,
        phoneNumber: u.phoneNumber,
        createdAt: u.createdAt
      }))
      return res.status(200).json({ success: true, users: safe })
    }

    if (req.method === 'POST') {
      const action = String(req.query?.action || req.body?.action || '').trim().toLowerCase()

      if (action === 'email-verification') {
        const { email, purpose, code, mode } = req.body || {}
        const normalizedEmail = normalizeEmail(email)
        const normalizedPurpose = String(purpose || '').trim().toLowerCase()
        const normalizedMode = String(mode || req.body?.action || '').trim().toLowerCase()

        if (!normalizedEmail || !normalizedPurpose || !ALLOWED_VERIFICATION_PURPOSES.has(normalizedPurpose)) {
          return res.status(400).json({ success: false, error: 'email and valid purpose are required' })
        }

        if (!isMsecEmail(normalizedEmail)) {
          return res.status(400).json({ success: false, error: 'Only @msec.edu.in email addresses are allowed' })
        }

        if (normalizedMode === 'request') {
          const now = new Date()
          const windowStart = new Date(now.getTime() - RATE_WINDOW_MS)
          const requestIp = getRequestIp(req)

          const [emailRequests, ipRequests] = await Promise.all([
            EmailVerification.countDocuments({
              email: normalizedEmail,
              purpose: normalizedPurpose,
              createdAt: { $gte: windowStart }
            }),
            EmailVerification.countDocuments({
              requestIp,
              createdAt: { $gte: windowStart }
            })
          ])

          if (emailRequests >= MAX_REQUESTS_PER_EMAIL || ipRequests >= MAX_REQUESTS_PER_IP) {
            return res.status(429).json({
              success: false,
              error: 'Too many verification requests. Please wait a few minutes and try again.'
            })
          }

          if (normalizedPurpose === 'login') {
            const [user, pendingRequest] = await Promise.all([
              User.findOne({ email: normalizedEmail }).select('_id').lean(),
              StaffApprovalRequest.findOne({ email: normalizedEmail }).select('_id').lean()
            ])

            if (!user && !pendingRequest) {
              return res.status(404).json({
                success: false,
                error: 'No account found for this email. Please check your email or sign up first.'
              })
            }
          }

          const otp = generateOtpCode()
          const verificationDoc = await createVerificationRequest({
            email: normalizedEmail,
            purpose: normalizedPurpose,
            code: otp,
            requestIp,
            userAgent: req.headers['user-agent'] || 'unknown'
          })

          const sent = await sendVerificationCodeEmail({
            to: normalizedEmail,
            code: otp,
            purpose: normalizedPurpose
          })

          if (!sent.success) {
            await EmailVerification.findByIdAndDelete(verificationDoc._id)
            return res.status(503).json({ success: false, error: sent.error || 'Failed to send verification email' })
          }

          const response = {
            success: true,
            message: 'Verification code sent to your email. It is valid for 10 minutes.'
          }

          if (sent.messageId) {
            console.log(`[users.js] OTP email sent to ${normalizedEmail}, messageId=${sent.messageId}`)
          }

          return res.status(200).json(response)
        }

        if (normalizedMode === 'verify') {
          if (!code) {
            return res.status(400).json({ success: false, error: 'code is required for verification' })
          }

          const result = await verifyOtpCode({
            email: normalizedEmail,
            purpose: normalizedPurpose,
            code
          })

          if (!result.success) {
            return res.status(result.status || 400).json({ success: false, error: result.error })
          }

          return res.status(200).json({
            success: true,
            message: 'Email verified successfully.',
            verificationToken: result.verificationToken,
            expiresInMinutes: result.expiresInMinutes
          })
        }

        return res.status(400).json({ success: false, error: 'Unsupported email verification action' })
      }

      // create academic user
      const { name, email, password, role, department, year, section, phoneNumber, creatorUserId, emailVerificationToken } = req.body
      if (!name || !email || !password || !role || !department) {
        return res.status(400).json({ success: false, error: 'name, email, password, role and department are required' })
      }

      // Validate email domain
      const emailDomain = email.toLowerCase().split('@')[1]
      if (emailDomain !== 'msec.edu.in') {
        return res.status(400).json({ success: false, error: 'Only @msec.edu.in email addresses are allowed' })
      }

      // Validate role
      if (!['staff', 'hod'].includes(role)) {
        return res.status(400).json({ success: false, error: 'role must be either staff or hod' })
      }

      // Validate department
      const validDepartments = ['CSE', 'AI_DS', 'ECE', 'MECH', 'CIVIL', 'EEE', 'IT', 'HNS']
      if (!validDepartments.includes(department)) {
        return res.status(400).json({ success: false, error: 'invalid department' })
      }

      // For staff, year and section are required
      if (role === 'staff' && (!year || !section)) {
        return res.status(400).json({ success: false, error: 'year and section are required for staff role' })
      }

      const existing = await User.findOne({ email: email.toLowerCase() })
      if (existing) {
        return res.status(409).json({ success: false, error: 'User already exists' })
      }

      let creatorUser = null
      if (creatorUserId) {
        try {
          creatorUser = await User.findById(creatorUserId).select('_id role name').lean()
        } catch (creatorLookupError) {
          creatorUser = null
        }
      }

      const isAdminCreatingStaff = role === 'staff' && creatorUser?.role === 'admin'

      if (!isAdminCreatingStaff) {
        if (!emailVerificationToken) {
          return res.status(403).json({
            success: false,
            error: 'Please verify your email before creating an account.'
          })
        }

        const verificationStatus = await consumeVerificationToken({
          email: email.toLowerCase(),
          purpose: 'signup',
          token: emailVerificationToken
        })

        if (!verificationStatus.success) {
          return res.status(403).json({
            success: false,
            error: verificationStatus.error || 'Email verification is required before signup.'
          })
        }
      }

      // Check if there's already a pending approval request
      if (!isAdminCreatingStaff) {
        const existingRequest = await StaffApprovalRequest.findOne({
          email: email.toLowerCase(),
          status: 'pending'
        })
        if (existingRequest) {
          return res.status(409).json({ success: false, error: 'You have already submitted a staff account request. Please wait for HOD approval.' })
        }
      }

      // For staff role, create an approval request instead of directly creating the user
      if (role === 'staff' && !isAdminCreatingStaff) {
        try {
          const hashed = await bcrypt.hash(password, 10)
          
          // Determine which HOD should approve this request
          let hodFilter;
          let hodDepartment;
          
          // For first-year staff, send request to HNS HOD
          // For other years, send to department HOD
          if (year === '1' || year === 'I' || year.toLowerCase() === 'first') {
            hodDepartment = 'HNS'
            hodFilter = { role: 'hod', department: 'HNS' }
          } else {
            hodDepartment = department
            hodFilter = { role: 'hod', department: department }
          }

          console.log('[users.js] Looking for HOD with filter:', hodFilter)
          const approvingHod = await User.findOne(hodFilter)
          console.log('[users.js] Found HOD:', approvingHod ? { id: approvingHod._id.toString(), name: approvingHod.name, email: approvingHod.email } : 'NOT FOUND')
          
          if (!approvingHod) {
            return res.status(400).json({ success: false, error: `No HOD found for ${hodDepartment} department. Please contact administration.` })
          }

          // Create approval request
          const approvalRequest = new StaffApprovalRequest({
            email: email.toLowerCase(),
            name,
            password: hashed,
            department,
            year,
            section,
            phoneNumber,
            status: 'pending',
            approvalHodId: approvingHod._id,
            approvalHodName: approvingHod.name,
            approvalHodEmail: approvingHod.email
          })

          console.log('[users.js] Creating StaffApprovalRequest with approvalHodId:', approvingHod._id.toString())
          await approvalRequest.save()
          console.log('[users.js] StaffApprovalRequest saved:', approvalRequest._id.toString())

          // Send notification to HOD
          try {
            const hodNotification = {
              userEmail: approvingHod.email,
              type: 'staff_account_approval',
              title: '🔔 New Staff Account Request',
              body: `${name} (${department} - Year ${year}, Section ${section}) has requested account access. Review and approve or reject.`,
              data: {
                requestId: approvalRequest._id.toString(),
                staffName: name,
                staffEmail: email.toLowerCase(),
                department: department,
                year: year,
                section: section,
                status: 'pending'
              },
              read: false,
              createdAt: new Date()
            }

            await storeNotification(hodNotification)

            // Try to send push notification
            const { subscriptions } = await getUserSubscriptions(approvingHod.email)
            const activeSubs = (subscriptions || []).filter(s => s.active === true || s.status === 'active')
            
            if (activeSubs.length > 0) {
              const payload = JSON.stringify({
                title: '🔔 New Staff Account Request',
                body: `${name} (${department} - Year ${year}, Section ${section}) needs approval`,
                icon: '/images/android-chrome-192x192.png',
                badge: '/images/favicon-32x32.png',
                tag: 'staff-account-request',
                data: { 
                  url: '/approval-requests',
                  requestId: approvalRequest._id.toString()
                }
              })

              for (const sub of activeSubs) {
                try {
                  await webpush.sendNotification(sub.subscription, payload)
                } catch (pushError) {
                  console.error('Push notification error:', pushError)
                }
              }
            }
          } catch (notifError) {
            console.error('Error sending approval notification:', notifError)
          }

          // Send notification to staff
          try {
            const staffNotification = {
              userEmail: email.toLowerCase(),
              type: 'staff_account_status',
              title: '📋 Account Registration Submitted',
              body: `Your staff account request has been submitted for approval by ${approvingHod.name} (${hodDepartment} HOD)`,
              data: {
                requestId: approvalRequest._id.toString(),
                status: 'pending'
              },
              read: false,
              createdAt: new Date()
            }

            await storeNotification(staffNotification)
          } catch (staffNotifError) {
            console.error('Error sending staff notification:', staffNotifError)
          }

          return res.status(201).json({ 
            success: true,
            message: 'Your account request has been submitted for HOD approval',
            requestId: approvalRequest._id.toString()
          })
        } catch (approvalError) {
          console.error('Error creating staff approval request:', approvalError)
          return res.status(500).json({ success: false, error: 'Failed to submit account request' })
        }
      }

      // For HOD role, or staff created by admin, create user directly
      const hashed = await bcrypt.hash(password, 10)
      const userData = {
        name,
        email: email.toLowerCase(),
        password: hashed,
        role,
        department,
        phoneNumber
      }

      if (role === 'staff') {
        userData.year = year
        userData.section = section
      }

      const user = new User(userData)
      await user.save()

      // If admin created this staff account, close any pending approval requests for the same email.
      if (isAdminCreatingStaff && creatorUser?._id) {
        await StaffApprovalRequest.updateMany(
          { email: email.toLowerCase(), status: 'pending' },
          {
            $set: {
              status: 'approved',
              approvedBy: creatorUser._id,
              approvedAt: new Date()
            }
          }
        )
      }

      // return safe user object
      const safe = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        year: user.year,
        section: user.section,
        phoneNumber: user.phoneNumber
      }
      return res.status(201).json({
        success: true,
        message: isAdminCreatingStaff ? 'Staff account created by admin (approval bypassed)' : 'User created successfully',
        user: safe
      })
    }

    if (req.method === 'DELETE') {
      // Expect JSON body with { userId }
      const { userId } = req.body || {}
      if (!userId) return res.status(400).json({ success: false, error: 'userId required' })

      try {
        const deleted = await User.findByIdAndDelete(userId)
        if (!deleted) return res.status(404).json({ success: false, error: 'User not found' })
        return res.status(200).json({ success: true, deleted: true })
      } catch (delErr) {
        console.error('Error deleting user:', delErr)
        return res.status(500).json({ success: false, error: 'Failed to delete user' })
      }
    }

    // PATCH endpoints for user updates
    if (req.method === 'PATCH') {
      const { action, userId } = req.query
      if (!action) return res.status(400).json({ success: false, error: 'action required' })

      if (action === 'access-policy') {
        const { adminUserId, staffHodWindowStartTime, staffHodWindowEndTime, enforceForStaffHod } = req.body || {}

        if (!adminUserId) {
          return res.status(400).json({ success: false, error: 'adminUserId is required' })
        }

        const adminUser = await User.findById(adminUserId).select('_id role').lean()
        if (!adminUser || String(adminUser.role || '').toLowerCase() !== 'admin') {
          return res.status(403).json({ success: false, error: 'Only admin can update access policy' })
        }

        const startMinutes = timeStringToMinutes(staffHodWindowStartTime, NaN)
        const endMinutes = timeStringToMinutes(staffHodWindowEndTime, NaN)

        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
          return res.status(400).json({ success: false, error: 'Valid start and end time are required (HH:mm)' })
        }

        if (startMinutes >= endMinutes) {
          return res.status(400).json({ success: false, error: 'Start time must be earlier than end time' })
        }

        const policy = await ensurePolicy()
        policy.staffHodWindowStart = startMinutes
        policy.staffHodWindowEnd = endMinutes
        policy.enforceForStaffHod = typeof enforceForStaffHod === 'boolean' ? enforceForStaffHod : true
        policy.updatedByUserId = adminUser._id
        await policy.save()

        return res.status(200).json({
          success: true,
          message: 'Access window updated successfully',
          policy: toResponsePolicy(policy)
        })
      }

      if (!userId) return res.status(400).json({ success: false, error: 'userId required' })

      if (action === 'update-signature') {
        const { eSignature } = req.body
        const u = await User.findByIdAndUpdate(userId, { eSignature }, { new: true }).lean()
        return res.status(200).json({ success: true, user: { id: u._id, eSignature: u.eSignature } })
      }

      if (action === 'update-profile') {
        const { name, phoneNumber } = req.body
        const updateData = {}
        if (name) updateData.name = name
        if (phoneNumber) updateData.phoneNumber = phoneNumber
        
        const u = await User.findByIdAndUpdate(userId, updateData, { new: true }).lean()
        return res.status(200).json({ success: true, user: { 
          id: u._id, 
          name: u.name, 
          phoneNumber: u.phoneNumber 
        }})
      }

      if (action === 'reset-password') {
        const { currentPassword, newPassword } = req.body
        if (!currentPassword || !newPassword) {
          return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required' })
        }

        if (newPassword.length < 6) {
          return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' })
        }

        try {
          // Find user and verify current password
          const user = await User.findById(userId)
          if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' })
          }

          // Verify current password
          const isPasswordValid = await bcrypt.compare(currentPassword, user.password)
          if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' })
          }

          // Hash new password and update
          const hashedPassword = await bcrypt.hash(newPassword, 10)
          const updatedUser = await User.findByIdAndUpdate(userId, { password: hashedPassword }, { new: true }).lean()

          return res.status(200).json({ success: true, message: 'Password updated successfully', user: { id: updatedUser._id, email: updatedUser.email } })
        } catch (error) {
          console.error('Error resetting password:', error)
          return res.status(500).json({ success: false, error: 'Failed to reset password' })
        }
      }

      return res.status(400).json({ success: false, error: 'unknown action' })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('Users API error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
