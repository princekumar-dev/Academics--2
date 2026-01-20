import mongoose from 'mongoose'

// User Schema for MSEC Academics
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'staff', 'hod'], required: true },
  name: { type: String, required: true },
  department: {
    type: String,
    enum: ['CSE', 'AI_DS', 'ECE', 'MECH', 'CIVIL', 'EEE', 'IT', 'HNS', 'ADMIN'],
    required: true
  },
  year: { type: String }, // For staff - which year they handle (I, II, III, IV, etc.)
  section: { type: String }, // For staff - which section they handle (A, B, C, etc.)
  eSignature: { type: String }, // Base64 encoded signature image
  phoneNumber: { type: String },
  createdAt: { type: Date, default: Date.now }
})

// Student Schema
const StudentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  regNumber: { type: String, required: true, unique: true },
  year: { type: String, required: true },
  section: { type: String, required: true },
  department: { type: String, enum: ['CSE', 'AI_DS', 'ECE', 'MECH', 'CIVIL', 'EEE', 'IT', 'HNS'], required: true },
  studentPhoneNumber: { type: String },
  studentPasswordHash: { type: String },
  parentPhoneNumber: { type: String, required: true },
  // Optional fields populated from import sessions
  examinationName: { type: String },
  examinationDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
})

// Marksheet Schema
const MarksheetSchema = new mongoose.Schema({
  marksheetId: { type: String, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentDetails: {
    name: String,
    regNumber: String,
    year: String,
    section: String,
    department: String,
    studentPhoneNumber: String,
    parentPhoneNumber: String,
    examinationName: String,
    examinationDate: Date
  },
  // Top-level examination fields
  examinationName: { type: String },
  examinationDate: { type: Date, required: true },
  semester: { type: String }, // Add semester field
  subjects: [{
    subjectName: { type: String, required: true },
    marks: { type: Number },
    result: { type: String, enum: ['Pass', 'Fail', 'Absent'], required: true }
  }],
  overallResult: { type: String, enum: ['Pass', 'Fail', 'Absent'] },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffName: { type: String, required: true },
  staffSignature: { type: String }, // Base64 encoded signature
  hodId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hodName: { type: String },
  hodSignature: { type: String }, // Base64 encoded signature
  principalSignature: { type: String }, // Base64 encoded signature
  status: {
    type: String,
    enum: ['draft', 'verified_by_staff', 'dispatch_requested', 'rescheduled_by_hod', 'approved_by_hod', 'rejected_by_hod', 'dispatched'],
    default: 'draft'
  },
  dispatchRequest: {
    requestedAt: Date,
    requestedBy: String,
    hodResponse: String, // 'approved', 'rejected', 'rescheduled'
    hodComments: String,
    scheduledDispatchDate: Date,
    respondedAt: Date,
    preDispatchNotificationSent: { type: Boolean, default: false },
    autoDispatched: { type: Boolean, default: false },
    autoDispatchFailed: { type: Boolean, default: false },
    dispatchError: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'rescheduled', 'dispatched'], default: 'pending' },
    dispatchedAt: Date
  },
  dispatchStatus: {
    dispatched: { type: Boolean, default: false },
    dispatchedAt: Date,
    whatsappStatus: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    whatsappError: String
  },
  // Track whether a staff (or reviewer) has "visited" this marksheet UI
  visited: { type: Boolean, default: false },
  visitedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Add indexes for query performance
MarksheetSchema.index({ staffId: 1, status: 1, createdAt: -1 })
MarksheetSchema.index({ 'studentDetails.department': 1, status: 1, createdAt: -1 })
MarksheetSchema.index({ 'studentDetails.year': 1, createdAt: -1 })
MarksheetSchema.index({ status: 1, createdAt: -1 })
// Note: marksheetId already has unique: true in schema, no need for separate index

// Excel Import Session Schema - for temporary storage during import
const ImportSessionSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  department: { type: String, required: true },
  year: { type: String, required: true },
  semester: { type: String },
  examinationName: { type: String },
  examinationDate: { type: Date, required: true },
  studentsData: [{
    name: String,
    regNumber: String,
    year: String,
    section: String,
    studentPhoneNumber: String,
    parentPhoneNumber: String,
    examinationName: String,
    examinationDate: Date,
    subjects: [{
      subjectName: String,
      marks: Number,
      result: { type: String, enum: ['Pass', 'Fail', 'Absent'] }
    }]
  }],
  status: { type: String, enum: ['pending', 'processed', 'error'], default: 'pending' },
  errorMessages: [String],
  createdAt: { type: Date, default: Date.now, expires: '24h' } // Auto-delete after 24 hours
})

// Leave/Late Request Schema
const LeaveRequestSchema = new mongoose.Schema({
  type: { type: String, enum: ['leave', 'late'], required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  studentDetails: {
    name: String,
    regNumber: String,
    year: String,
    section: String,
    department: String,
    parentPhoneNumber: String
  },
  reason: { type: String, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  expectedArrivalTime: { type: Date },
  recordedAt: { type: Date }, // When staff clicked "Record" button
  arrivalConfirmedAt: { type: Date }, // When student clicked "Reached" button
  arrivalRecordedAt: { type: Date }, // Legacy field
  status: { type: String, enum: ['requested', 'waiting_for_arrival_confirmation', 'approved_by_hod', 'rejected_by_hod', 'acknowledged_by_staff'], default: 'requested' },
  hodId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hodName: { type: String },
  hodSignature: { type: String },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  staffName: { type: String },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

LeaveRequestSchema.index({ 'studentDetails.department': 1, type: 1, status: 1, createdAt: -1 })
LeaveRequestSchema.index({ studentId: 1, type: 1, createdAt: -1 })

LeaveRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

// Staff Approval Request Schema - for pending staff account approvals from HOD
const StaffApprovalRequestSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
  password: { type: String, required: true }, // Will be hashed and stored temporarily
  department: {
    type: String,
    enum: ['CSE', 'AI_DS', 'ECE', 'MECH', 'CIVIL', 'EEE', 'IT', 'HNS'],
    required: true
  },
  year: { type: String, required: true }, // I, II, III, IV
  section: { type: String, required: true }, // A, B, etc.
  phoneNumber: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  approvalHodId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Which HOD should approve
  approvalHodName: { type: String },
  approvalHodEmail: { type: String },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who approved it
  rejectionReason: { type: String }, // If rejected, why?
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

StaffApprovalRequestSchema.index({ email: 1 })
StaffApprovalRequestSchema.index({ status: 1, approvalHodId: 1 })
StaffApprovalRequestSchema.index({ department: 1, year: 1, status: 1 })

StaffApprovalRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

// Generate marksheet ID before saving
MarksheetSchema.pre('save', function(next) {
  if (!this.marksheetId) {
    this.marksheetId = 'MS' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase()
  }
  this.updatedAt = new Date()
  next()
})

// Generate import session ID before saving
ImportSessionSchema.pre('save', function(next) {
  if (!this.sessionId) {
    this.sessionId = 'IMP' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase()
  }
  next()
})

// Force use specific collection names and avoid conflicts with old models
// Clear any existing models to prevent conflicts
if (mongoose.models.User) delete mongoose.models.User
if (mongoose.models.Student) delete mongoose.models.Student
if (mongoose.models.Marksheet) delete mongoose.models.Marksheet
if (mongoose.models.ImportSession) delete mongoose.models.ImportSession
if (mongoose.models.LeaveRequest) delete mongoose.models.LeaveRequest
if (mongoose.models.StaffApprovalRequest) delete mongoose.models.StaffApprovalRequest

// Create new models with explicit collection names
export const User = mongoose.model('User', UserSchema)
export const Student = mongoose.model('Student', StudentSchema)  
export const Marksheet = mongoose.model('Marksheet', MarksheetSchema)
export const ImportSession = mongoose.model('ImportSession', ImportSessionSchema)
export const LeaveRequest = mongoose.model('LeaveRequest', LeaveRequestSchema)
export const StaffApprovalRequest = mongoose.model('StaffApprovalRequest', StaffApprovalRequestSchema)