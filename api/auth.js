import { connectToDatabase } from '../lib/mongo.js'
import { User, Student, StaffApprovalRequest } from '../models.js'
import bcrypt from 'bcryptjs'

const DEFAULT_STUDENT_PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD || 'msec@123'

export default async function handler(req, res) {
  // CORS is already handled by the cors middleware in server.js

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'POST') {
    try {
      console.log('🔐 [AUTH] Login attempt received')
      // Connect to database
      try {
        await connectToDatabase()
        console.log('🔐 [AUTH] Database connected')
      } catch (dbError) {
        console.error('❌ [AUTH] Database connection error:', dbError.message)
        return res.status(503).json({
          success: false,
          error: 'Database connection error. Please check MongoDB connection.'
        })
      }

      const { email, password, regNumber, loginType } = req.body
      console.log('🔐 [AUTH] Request body:', { email, password: password ? '***' : 'none', regNumber, loginType })

      // Site policy: enforce IST time window (8:30 AM – 5:00 PM)
      // Outside working hours, only students can access
      const isStudent = loginType === 'student' || (!!regNumber && !email)
      const nowIST = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(new Date())
      const hour = Number(nowIST.find(p => p.type === 'hour')?.value || '0')
      const minute = Number(nowIST.find(p => p.type === 'minute')?.value || '0')
      const nowMinutes = hour * 60 + minute
      const windowStart = 8 * 60 + 30  // 8:30 AM
      const windowEnd = 17 * 60         // 5:00 PM
      const withinWindow = nowMinutes >= windowStart && nowMinutes <= windowEnd

      if (!withinWindow && !isStudent) {
        return res.status(403).json({
          success: false,
          error: 'Access restricted: only students can access this website outside working hours (8:30 AM – 5:00 PM IST).'
        })
      }

      if (!withinWindow && isStudent) {
        return res.status(403).json({
          success: false,
          error: 'Login is allowed only between 8:30 AM and 5:00 PM IST.'
        })
      }

      // Student login branch (registration number + default password)
      if (isStudent) {
        if (!regNumber || !password) {
          return res.status(400).json({
            success: false,
            error: 'Registration number and password are required'
          })
        }

        // Find student by registration number
        const student = await Student.findOne({
          regNumber: regNumber.toUpperCase().trim()
        })

        if (!student) {
          return res.status(401).json({
            success: false,
            error: 'Invalid registration number or password'
          })
        }

        let passwordMatches = false
        if (student.studentPasswordHash) {
          passwordMatches = await bcrypt.compare(password, student.studentPasswordHash)
        } else {
          // Accept default password and set hash on first successful login
          passwordMatches = password === DEFAULT_STUDENT_PASSWORD
          if (passwordMatches) {
            try {
              student.studentPasswordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10)
              await student.save()
            } catch (hashErr) {
              console.warn('Could not persist student password hash:', hashErr?.message)
            }
          }
        }

        if (!passwordMatches) {
          return res.status(401).json({
            success: false,
            error: 'Invalid registration number or password'
          })
        }

        return res.status(200).json({
          success: true,
          user: {
            id: student._id,
            name: student.name,
            role: 'student',
            department: student.department,
            year: student.year,
            section: student.section,
            regNumber: student.regNumber,
            phoneNumber: student.parentPhoneNumber,
            parentPhoneNumber: student.parentPhoneNumber
          }
        })
      }

      // Staff / HOD login branch (email + bcrypt password)
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        })
      }

      const normalizedEmail = email.toLowerCase().trim()
      const user = await User.findOne({ email: normalizedEmail })
      if (!user) {
        const latestApprovalRequest = await StaffApprovalRequest
          .findOne({ email: normalizedEmail })
          .sort({ createdAt: -1, updatedAt: -1 })

        if (latestApprovalRequest) {
          const passwordMatchesPendingRequest = await bcrypt.compare(password, latestApprovalRequest.password)

          if (passwordMatchesPendingRequest) {
            if (latestApprovalRequest.status === 'pending') {
              return res.status(403).json({
                success: false,
                error: 'Your staff account is waiting for HOD approval. Please try again after approval.'
              })
            }

            if (latestApprovalRequest.status === 'rejected') {
              const rejectionReason = String(latestApprovalRequest.rejectionReason || '').trim()
              return res.status(403).json({
                success: false,
                error: rejectionReason
                  ? `Your staff account request was rejected by the HOD. Reason: ${rejectionReason}`
                  : 'Your staff account request was rejected by the HOD. Please contact your department HOD.'
              })
            }
          }

          return res.status(401).json({
            success: false,
            error: 'Invalid password'
          })
        }

        return res.status(401).json({
          success: false,
          error: 'Invalid email address. No account found for this email.'
        })
      }

      const passwordMatches = await bcrypt.compare(password, user.password)
      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password'
        })
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          year: user.year,
          section: user.section,
          eSignature: user.eSignature || null,
          phoneNumber: user.phoneNumber
        }
      })

    } catch (error) {
      console.error('Authentication error:', error)
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }
}
