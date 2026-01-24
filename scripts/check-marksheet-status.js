import mongoose from 'mongoose'
import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet } from '../models.js'

async function checkMarksheet() {
  try {
    await connectToDatabase()
    
    const marksheetId = '69161b0e4a4f645d67355156'
    const marksheet = await Marksheet.findById(marksheetId)
      .populate('staffId', 'name email')
      .populate('hodId', 'name email')
      .lean()
    
    if (!marksheet) {
      console.log(`❌ Marksheet ${marksheetId} not found`)
      process.exit(1)
    }
    
    console.log('\n📋 Marksheet Details:')
    console.log('ID:', marksheet._id)
    console.log('Marksheet ID:', marksheet.marksheetId)
    console.log('Student:', marksheet.studentDetails?.name)
    console.log('Parent Phone:', marksheet.studentDetails?.parentPhoneNumber)
    console.log('\n📊 Status Information:')
    console.log('Main Status:', marksheet.status)
    console.log('Dispatch Request Status:', marksheet.dispatchRequest?.status)
    console.log('HOD Response:', marksheet.dispatchRequest?.hodResponse)
    console.log('Scheduled Date:', marksheet.dispatchRequest?.scheduledDispatchDate)
    console.log('Auto-Dispatched:', marksheet.dispatchRequest?.autoDispatched)
    console.log('Dispatch Failed:', marksheet.dispatchRequest?.autoDispatchFailed)
    console.log('Dispatch Error:', marksheet.dispatchRequest?.dispatchError)
    
    console.log('\n👤 People:')
    console.log('Staff:', marksheet.staffId?.name, '-', marksheet.staffId?.email)
    console.log('HOD:', marksheet.hodId?.name, '-', marksheet.hodId?.email)
    
    console.log('\n✅ Analysis:')
    const allowedStatuses = ['approved_by_hod', 'rescheduled_by_hod']
    const canDispatch = allowedStatuses.includes(marksheet.status)
    console.log(`Can Dispatch: ${canDispatch ? '✅ YES' : '❌ NO'}`)
    console.log(`Current status "${marksheet.status}" ${canDispatch ? 'IS' : 'IS NOT'} in allowed list: ${allowedStatuses.join(', ')}`)
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkMarksheet()
