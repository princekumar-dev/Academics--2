import { connectToDatabase } from '../lib/mongo.js'
import { User, Student, StaffApprovalRequest } from '../models.js'
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
    console.error('DB connect error in users API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'GET') {
      const { action, userId, studentPhoneNumber, regNumber } = req.query

      // Get student by phone number and/or reg number (for fetching fresh data in StudentDashboard)
      if (studentPhoneNumber || regNumber) {
        const query = { $or: [] }
        
        if (studentPhoneNumber) {
          query.$or.push({ parentPhoneNumber: studentPhoneNumber })
          query.$or.push({ studentPhoneNumber: studentPhoneNumber })
        }
        
        if (regNumber) {
          query.$or.push({ regNumber: regNumber })
        }

        const student = await Student.findOne(query).lean()
        
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

        const user = await User.findById(userId).lean()
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

      // list users for academic system
      const users = await User.find().sort({ createdAt: -1 }).lean()
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
      // create academic user
      const { name, email, password, role, department, year, section, phoneNumber } = req.body
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

      // Check if there's already a pending approval request
      const existingRequest = await StaffApprovalRequest.findOne({ 
        email: email.toLowerCase(),
        status: 'pending'
      })
      if (existingRequest) {
        return res.status(409).json({ success: false, error: 'You have already submitted a staff account request. Please wait for HOD approval.' })
      }

      // For staff role, create an approval request instead of directly creating the user
      if (role === 'staff') {
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

      // For HOD role, create user directly (no approval needed)
      const hashed = await bcrypt.hash(password, 10)
      const userData = {
        name,
        email: email.toLowerCase(),
        password: hashed,
        role,
        department,
        phoneNumber
      }

      const user = new User(userData)
      await user.save()

      // return safe user object
      const safe = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        phoneNumber: user.phoneNumber
      }
      return res.status(201).json({ success: true, user: safe })
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
      if (!action || !userId) return res.status(400).json({ success: false, error: 'action and userId required' })

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
