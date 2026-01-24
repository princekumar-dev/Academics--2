import { connectToDatabase } from '../lib/mongo.js'
import { User, Marksheet, Student } from '../models.js'
import mongoose from 'mongoose'

// Examination Schema
const ExaminationSchema = new mongoose.Schema({
  examinationName: { type: String, required: true },
  year: { type: String, required: true }, // I, II, III, IV
  semester: { type: String, required: true }, // I, II, III, IV, V, VI, VII, VIII
  academicYear: { type: String, required: true }, // e.g., "2024-25"
  examinationMonth: { type: String, required: true }, // 1-12
  examinationYear: { type: String, required: true }, // e.g., "2025"
  department: { type: String, required: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffName: { type: String, required: true },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Create the model
const Examination = mongoose.models.Examination || mongoose.model('Examination', ExaminationSchema)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await connectToDatabase()
  } catch (dbErr) {
    console.error('DB connect error in examinations API:', dbErr.message)
    return res.status(503).json({ success: false, error: 'Database connection failed' })
  }

  try {
    if (req.method === 'POST') {
      const { 
        examinationName, 
        year, 
        semester, 
        academicYear, 
        examinationMonth, 
        examinationYear,
        staffId 
      } = req.body

      // Validate required fields
      if (!examinationName || !year || !semester || !academicYear || !examinationMonth || !examinationYear || !staffId) {
        return res.status(400).json({ 
          success: false, 
          error: 'All examination details are required' 
        })
      }

      // Get staff information
      const staff = await User.findById(staffId)
      if (!staff) {
        return res.status(404).json({ success: false, error: 'Staff not found' })
      }

      // Create examination
      const examination = new Examination({
        examinationName,
        year,
        semester,
        academicYear,
        examinationMonth,
        examinationYear,
        department: staff.department,
        staffId: staff._id,
        staffName: staff.name
      })

      await examination.save()

      return res.status(201).json({
        success: true,
        message: 'Examination created successfully',
        examination: {
          _id: examination._id,
          examinationName: examination.examinationName,
          year: examination.year,
          semester: examination.semester,
          academicYear: examination.academicYear,
          examinationMonth: examination.examinationMonth,
          examinationYear: examination.examinationYear,
          department: examination.department,
          staffName: examination.staffName,
          status: examination.status,
          createdAt: examination.createdAt
        }
      })
    }

    if (req.method === 'GET') {
      const { staffId, department } = req.query

      // Build query
      let query = {}
      if (staffId) {
        query.staffId = staffId
      }
      if (department) {
        query.department = department
      }

      // Get examinations
      const examinations = await Examination.find(query)
        .sort({ createdAt: -1 })
        .populate('staffId', 'name department')

      return res.status(200).json({
        success: true,
        examinations: examinations.map(exam => ({
          _id: exam._id,
          examinationName: exam.examinationName,
          year: exam.year,
          semester: exam.semester,
          academicYear: exam.academicYear,
          examinationMonth: exam.examinationMonth,
          examinationYear: exam.examinationYear,
          department: exam.department,
          staffName: exam.staffName,
          status: exam.status,
          createdAt: exam.createdAt
        }))
      })
    }

    if (req.method === 'DELETE') {
      const { examinationId, staffId } = req.body || {}
      if (!examinationId) {
        return res.status(400).json({ success: false, error: 'examinationId is required' })
      }

      const exam = await Examination.findById(examinationId).lean()
      if (!exam) {
        return res.status(404).json({ success: false, error: 'Examination not found' })
      }

      // If staffId provided, ensure only the owner can delete
      if (staffId && exam.staffId && exam.staffId.toString() !== staffId) {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this examination' })
      }

      // Build date range for the examination month/year
      let startDate = null
      let endDate = null
      try {
        const month = Number(exam.examinationMonth)
        const year = Number(exam.examinationYear)
        if (!isNaN(month) && !isNaN(year)) {
          startDate = new Date(year, month - 1, 1)
          endDate = new Date(year, month, 1) // next month
        }
      } catch (e) {}

      // Delete marksheets matching examinationName + date range + department
      const marksheetFilter = { examinationName: exam.examinationName, 'studentDetails.department': exam.department }
      if (startDate && endDate) {
        marksheetFilter.examinationDate = { $gte: startDate, $lt: endDate }
      }

      const marksheetDeleteResult = await Marksheet.deleteMany(marksheetFilter)

      // Delete students that were created specifically for this examination (match examinationName/date/department)
      const studentFilter = { examinationName: exam.examinationName, department: exam.department }
      if (startDate && endDate) {
        studentFilter.examinationDate = { $gte: startDate, $lt: endDate }
      }
      const studentDeleteResult = await Student.deleteMany(studentFilter)

      // Finally remove the examination document
      await Examination.findByIdAndDelete(examinationId)

      return res.status(200).json({
        success: true,
        message: 'Examination and associated marksheets/students deleted',
        deleted: {
          marksheets: marksheetDeleteResult.deletedCount || 0,
          students: studentDeleteResult.deletedCount || 0
        }
      })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })

  } catch (error) {
    console.error('Error in examinations API:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
}