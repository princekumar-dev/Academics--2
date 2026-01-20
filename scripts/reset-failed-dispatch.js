import mongoose from 'mongoose'
import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet } from '../models.js'

async function resetFailedDispatch() {
  try {
    await connectToDatabase()
    
    const marksheetId = '69161b0e4a4f645d67355156'
    
    // Reset the failed dispatch flags so it will retry
    const result = await Marksheet.findByIdAndUpdate(
      marksheetId,
      {
        'dispatchRequest.autoDispatched': false,
        'dispatchRequest.autoDispatchFailed': false,
        'dispatchRequest.dispatchError': null
      },
      { new: true }
    )
    
    if (!result) {
      console.log(`❌ Marksheet ${marksheetId} not found`)
      process.exit(1)
    }
    
    console.log('✅ Reset dispatch flags for marksheet:', marksheetId)
    console.log('Status:', result.status)
    console.log('Dispatch Request Status:', result.dispatchRequest.status)
    console.log('Auto-Dispatched:', result.dispatchRequest.autoDispatched)
    console.log('Dispatch Failed:', result.dispatchRequest.autoDispatchFailed)
    console.log('\n🔄 The marksheet will be retried on the next scheduled dispatch check')
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

resetFailedDispatch()
