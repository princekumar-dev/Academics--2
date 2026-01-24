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

      // Staff/HOD login branch (email + password)
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        })
      }

      // Basic validation
      const emailDomain = email.toLowerCase().split('@')[1]
      if (emailDomain !== 'msec.edu.in') {
        return res.status(400).json({
          success: false,
          error: 'Only @msec.edu.in email addresses are allowed'
        })
      }

      // Find user in msec_academics database
      console.log('🔐 [AUTH] Looking up user:', email.toLowerCase())
      const user = await User.findOne({ email: email.toLowerCase() })
      console.log('🔐 [AUTH] User lookup result:', user ? 'found' : 'not found')
      
      // Check if user exists OR if there's a pending staff approval request
      if (!user) {
        // Check if there's a pending approval request
        const pendingRequest = await StaffApprovalRequest.findOne({
          email: email.toLowerCase(),
          status: 'pending'
        })
        
        if (pendingRequest) {
          return res.status(401).json({
            success: false,
            error: 'Your account is pending approval. Please wait for HOD approval before logging in.'
          })
        }
        
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        })
      }

      console.log('✅ [AUTH] User found:', { email: user.email, role: user.role })
      // Compare submitted password with hashed password from DB
      console.log('🔐 [AUTH] Checking password...')
      const passwordMatches = await bcrypt.compare(password, user.password)
      console.log('🔐 [AUTH] Password match result:', passwordMatches)
      if (!passwordMatches) {
        console.log('❌ [AUTH] Password mismatch')
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        })
      }

      // Authentication successful
      console.log('✅ [AUTH] Authentication successful for:', user.email)
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
          eSignature: user.eSignature
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