import { connectToDatabase } from '../lib/mongo.js'
import { Student } from '../models.js'

async function testStudentLogin() {
  try {
    await connectToDatabase()
    console.log('✅ Connected to database')
    
    const regNumber = '243115243077'
    console.log(`\n🔍 Searching for student with regNumber: ${regNumber}`)
    
    const student = await Student.findOne({
      regNumber: regNumber.toUpperCase().trim()
    })
    
    if (student) {
      console.log('✅ Student found!')
      console.log('Student details:')
      console.log(`  - Name: ${student.name}`)
      console.log(`  - Reg Number: ${student.regNumber}`)
      console.log(`  - Email: ${student.email}`)
      console.log(`  - Parent Phone: ${student.parentPhoneNumber}`)
      console.log(`  - Department: ${student.department}`)
      console.log(`  - Year: ${student.year}`)
      console.log(`  - Section: ${student.section}`)
      console.log(`  - Has password hash: ${!!student.studentPasswordHash}`)
    } else {
      console.log('❌ Student not found')
      console.log('\n📋 All students in database:')
      const allStudents = await Student.find({}).select('regNumber name parentPhoneNumber')
      allStudents.slice(0, 10).forEach(s => {
        console.log(`  - ${s.regNumber}: ${s.name}`)
      })
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

testStudentLogin()
