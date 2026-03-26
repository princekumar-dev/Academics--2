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

      // Site policy: only students can access
      if (!(loginType === 'student' || (!!regNumber && !email))) {
        return res.status(403).json({
          success: false,
          error: 'Access restricted: only students can access this website.'
        })
      }

      // Student login branch (registration number + default password)
      if (loginType === 'student' || (!!regNumber && !email)) {
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

      return res.status(403).json({
        success: false,
        error: 'Access restricted: only students can access this website.'
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