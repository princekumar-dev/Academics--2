// Debug script to check database state for staff approval
import { connectToDatabase } from '../lib/mongo.js'
import { User, StaffApprovalRequest } from '../models.js'

async function debugStaffApproval() {
  try {
    await connectToDatabase()
    console.log('\n=== DATABASE DEBUG ===\n')

    // Check all HODs in database
    console.log('1. ALL HODS IN DATABASE:')
    const hods = await User.find({ role: 'hod' }).lean()
    console.log(`   Found ${hods.length} HODs:`)
    hods.forEach(hod => {
      console.log(`   - ${hod.name} (${hod.email}) - Department: ${hod.department} - ID: ${hod._id}`)
    })

    // Check all pending approval requests
    console.log('\n2. ALL PENDING STAFF APPROVAL REQUESTS:')
    const pendingRequests = await StaffApprovalRequest.find({ status: 'pending' }).lean()
    console.log(`   Found ${pendingRequests.length} pending requests:`)
    pendingRequests.forEach(req => {
      console.log(`   - ${req.name} (${req.email})`)
      console.log(`     Department: ${req.department}, Year: ${req.year}, Section: ${req.section}`)
      console.log(`     Approving HOD ID: ${req.approvalHodId}`)
      console.log(`     HOD Name: ${req.approvalHodName} (${req.approvalHodEmail})`)
    })

    // For each HOD, show pending requests assigned to them
    console.log('\n3. PENDING REQUESTS BY HOD:')
    for (const hod of hods) {
      const requestsForHod = await StaffApprovalRequest.find({
        approvalHodId: hod._id,
        status: 'pending'
      }).lean()
      console.log(`   ${hod.name} (${hod.department}): ${requestsForHod.length} pending requests`)
      requestsForHod.forEach(req => {
        console.log(`      - ${req.name} (${req.email})`)
      })
    }

    // Check all approved staff
    console.log('\n4. ALL APPROVED STAFF:')
    const approvedStaff = await User.find({ role: 'staff' }).lean()
    console.log(`   Found ${approvedStaff.length} approved staff users`)
    approvedStaff.forEach(staff => {
      console.log(`   - ${staff.name} (${staff.email}) - Department: ${staff.department}`)
    })

  } catch (error) {
    console.error('Error:', error)
  }
  process.exit(0)
}

debugStaffApproval()
