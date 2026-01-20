import mongoose from 'mongoose'
import { connectToDatabase } from '../lib/mongo.js'
import { Marksheet } from '../models.js'

async function addIndexes() {
  try {
    console.log('Connecting to database...')
    await connectToDatabase()
    
    console.log('Adding indexes to Marksheet collection...')
    
    // Get existing indexes
    const existingIndexes = await Marksheet.collection.getIndexes()
    console.log('Existing indexes:', Object.keys(existingIndexes))
    
    // Create new indexes
    await Marksheet.collection.createIndex(
      { staffId: 1, status: 1, createdAt: -1 },
      { name: 'staffId_status_createdAt' }
    )
    console.log('✓ Created index: staffId_status_createdAt')
    
    await Marksheet.collection.createIndex(
      { 'studentDetails.department': 1, status: 1, createdAt: -1 },
      { name: 'department_status_createdAt' }
    )
    console.log('✓ Created index: department_status_createdAt')
    
    await Marksheet.collection.createIndex(
      { 'studentDetails.year': 1, createdAt: -1 },
      { name: 'year_createdAt' }
    )
    console.log('✓ Created index: year_createdAt')
    
    await Marksheet.collection.createIndex(
      { status: 1, createdAt: -1 },
      { name: 'status_createdAt' }
    )
    console.log('✓ Created index: status_createdAt')
    
    await Marksheet.collection.createIndex(
      { marksheetId: 1 },
      { name: 'marksheetId_unique', unique: true }
    )
    console.log('✓ Created index: marksheetId_unique')
    
    // Get updated indexes
    const updatedIndexes = await Marksheet.collection.getIndexes()
    console.log('\nAll indexes:', Object.keys(updatedIndexes))
    
    console.log('\n✅ Successfully added all indexes!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error adding indexes:', error)
    process.exit(1)
  }
}

addIndexes()
