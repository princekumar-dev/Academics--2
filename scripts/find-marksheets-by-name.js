// Usage: node scripts/find-marksheets-by-name.js "Rohith" [department]
// Example: node scripts/find-marksheets-by-name.js "Rohith" IT

import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet } from '../models.js'

const nameArg = process.argv[2]
const deptArg = process.argv[3]

if (!nameArg) {
  console.error('Usage: node scripts/find-marksheets-by-name.js "Student Name" [department]')
  process.exit(1)
}

async function run() {
  try {
    await connectToDatabase()
    const q = { 'studentDetails.name': { $regex: `^${nameArg}$`, $options: 'i' } }
    if (deptArg) q['studentDetails.department'] = deptArg

    const results = await Marksheet.find(q).sort({ createdAt: -1 }).limit(200).lean()

    if (!results || results.length === 0) {
      console.log(`No marksheets found for name='${nameArg}'${deptArg ? ` and department='${deptArg}'` : ''}`)
      process.exit(0)
    }

    console.log(`Found ${results.length} marksheet(s) for name='${nameArg}'${deptArg ? ` and department='${deptArg}'` : ''}:\n`)
    for (const m of results) {
      console.log(`- marksheetId: ${m._id} | regNumber: ${m.studentDetails?.regNumber || 'N/A'} | department: ${m.studentDetails?.department || 'N/A'} | exam: ${m.examinationName || 'N/A'} | createdAt: ${m.createdAt}`)
    }

    process.exit(0)
  } catch (err) {
    console.error('Error running diagnostic:', err)
    process.exit(2)
  }
}

run()
