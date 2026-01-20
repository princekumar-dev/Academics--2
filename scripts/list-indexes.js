import mongoose from 'mongoose'
import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet } from '../models.js'

async function listIndexes() {
  try {
    console.log('Connecting to database...')
    await connectToDatabase()
    
    console.log('Current indexes on Marksheet collection:')
    const indexes = await Marksheet.collection.getIndexes()
    
    for (const [name, spec] of Object.entries(indexes)) {
      console.log(`\n${name}:`, JSON.stringify(spec, null, 2))
    }
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

listIndexes()
