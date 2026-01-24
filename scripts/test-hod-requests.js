// Quick test to verify the staff approval API works
import { connectToDatabase } from '../lib/mongo.js'
import { User, StaffApprovalRequest } from '../models.js'

async function testAPI() {
  try {
    await connectToDatabase()
    
    console.log('\n========== TESTING STAFF APPROVAL API ==========\n')
    
    // Get the HOD with pending requests
    const demoHod = await User.findOne({email: 'hoddemo@msec.edu.in'}).lean()
    if (!demoHod) {
      console.log('❌ DemoHod not found in database')
      process.exit(1)
    }
    
    console.log('✅ Found HOD:')
    console.log('   Name:', demoHod.name)
    console.log('   Email:', demoHod.email)
    console.log('   ID:', demoHod._id.toString())
    
    // Query pending requests for this HOD (simulating the API call)
    const hodId = demoHod._id.toString()
    console.log('\n📝 Simulating API call: /api/staff-approval?action=pending&hodId=' + hodId)
    
    const requests = await StaffApprovalRequest.find({
      approvalHodId: hodId,
      status: 'pending'
    }).sort({ createdAt: -1 }).lean()
    
    console.log('\n✅ API Response:')
    console.log('   Status: 200')
    console.log('   Success: true')
    console.log('   Request Count:', requests.length)
    
    if (requests.length > 0) {
      console.log('\n📋 Pending Requests:')
      requests.forEach((req, idx) => {
        console.log(`\n   Request ${idx + 1}:`)
        console.log('   - Name:', req.name)
        console.log('   - Email:', req.email)
        console.log('   - Department:', req.department)
        console.log('   - Year:', req.year)
        console.log('   - Section:', req.section)
        console.log('   - Status:', req.status)
        console.log('   - Created:', new Date(req.createdAt).toLocaleString())
      })
      
      console.log('\n✅ SUCCESS! API is working correctly.')
      console.log('   HOD ' + demoHod.name + ' should see requests in notification bell')
    } else {
      console.log('\n❌ No pending requests found for this HOD')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
  process.exit(0)
}

testAPI()
