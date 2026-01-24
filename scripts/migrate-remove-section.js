#!/usr/bin/env node
/*
  Migration script: merge existing `section` into `class` where missing, then remove `section` fields.
  - Students: if `section` exists and `class` doesn't already contain the section, set class = `${class}-${section}` (or class=section when class missing)
  - Marksheet.studentDetails: same merge logic
  - ImportSession.studentsData (array): same merge per-item

  Usage: from repo root run `cd rc ; node scripts/migrate-remove-section.js`
  NOTE: This script will modify your DB. Make a backup before running in production.
*/

import { connectToDatabase } from '../lib/mongo.js'
import { Student, Marksheet, ImportSession } from '../models.js'

function safeTrim(s) {
  if (typeof s !== 'string') return ''
  return s.trim()
}

function shouldAppend(existingClass, section) {
  if (!section) return false
  if (!existingClass) return true
  // if class already contains the section token, don't append
  try {
    if (existingClass.includes(section)) return false
  } catch (e) {
    return true
  }
  return true
}

async function migrateStudents() {
  let updated = 0
  console.log('\n-- Students migration')
  const cursor = Student.find({ section: { $exists: true } }).cursor()
  for await (const doc of cursor) {
    const section = safeTrim(doc.section)
    let currentClass = doc.class ? safeTrim(doc.class) : ''

    if (!section) {
      // just unset empty section
      await Student.updateOne({ _id: doc._id }, { $unset: { section: '' } })
      continue
    }

    if (shouldAppend(currentClass, section)) {
      let newClass = currentClass
      if (!newClass) newClass = section
      else if (!newClass.includes(section)) newClass = `${newClass}-${section}`

      await Student.updateOne({ _id: doc._id }, { $set: { class: newClass }, $unset: { section: '' } })
      updated++
      console.log(`Updated Student ${doc._id}: class -> "${newClass}"`)
    } else {
      // already contains section, just remove the field
      await Student.updateOne({ _id: doc._id }, { $unset: { section: '' } })
      console.log(`Cleaned Student ${doc._id}: removed duplicate section`)
    }
  }
  console.log(`Students touched: ${updated}`)
  return updated
}

async function migrateMarksheets() {
  let updated = 0
  console.log('\n-- Marksheet.studentDetails migration')
  const cursor = Marksheet.find({ 'studentDetails.section': { $exists: true } }).cursor()
  for await (const doc of cursor) {
    const sd = doc.studentDetails || {}
    const section = safeTrim(sd.section)
    let curClass = sd.class ? safeTrim(sd.class) : ''

    if (!section) {
      await Marksheet.updateOne({ _id: doc._id }, { $unset: { 'studentDetails.section': '' } })
      continue
    }

    if (shouldAppend(curClass, section)) {
      let newClass = curClass
      if (!newClass) newClass = section
      else if (!newClass.includes(section)) newClass = `${newClass}-${section}`

      await Marksheet.updateOne({ _id: doc._id }, { $set: { 'studentDetails.class': newClass }, $unset: { 'studentDetails.section': '' } })
      updated++
      console.log(`Updated Marksheet ${doc._id}: studentDetails.class -> "${newClass}"`)
    } else {
      await Marksheet.updateOne({ _id: doc._id }, { $unset: { 'studentDetails.section': '' } })
      console.log(`Cleaned Marksheet ${doc._id}: removed duplicate studentDetails.section`)
    }
  }
  console.log(`Marksheets touched: ${updated}`)
  return updated
}

async function migrateImportSessions() {
  let updatedDocs = 0
  let updatedItems = 0
  console.log('\n-- ImportSession.studentsData migration')
  const cursor = ImportSession.find({ 'studentsData.section': { $exists: true } }).cursor()
  for await (const doc of cursor) {
    const students = doc.studentsData || []
    let modified = false

    for (let i = 0; i < students.length; i++) {
      const item = students[i]
      const section = safeTrim(item.section)
      let curClass = item.class ? safeTrim(item.class) : ''

      if (!section) continue

      if (shouldAppend(curClass, section)) {
        let newClass = curClass
        if (!newClass) newClass = section
        else if (!newClass.includes(section)) newClass = `${newClass}-${section}`

        students[i].class = newClass
        updatedItems++
        modified = true
        console.log(`Will update ImportSession ${doc._id} item ${i}: class -> "${newClass}"`)
      } else {
        // just drop section
        modified = true
      }

      // remove the section property from the in-memory item
      if (students[i].hasOwnProperty('section')) delete students[i].section
    }

    if (modified) {
      await ImportSession.updateOne({ _id: doc._id }, { $set: { studentsData: students } })
      updatedDocs++
      console.log(`Patched ImportSession ${doc._id}`)
    }
  }
  console.log(`ImportSession documents updated: ${updatedDocs}, items changed: ${updatedItems}`)
  return { updatedDocs, updatedItems }
}

async function run() {
  try {
    await connectToDatabase()
    console.log('\nConnected. Starting migration...')

    const sCount = await migrateStudents()
    const mCount = await migrateMarksheets()
    const imp = await migrateImportSessions()

    console.log('\nMigration complete:')
    console.log(`  Students updated: ${sCount}`)
    console.log(`  Marksheets updated: ${mCount}`)
    console.log(`  ImportSession docs updated: ${imp.updatedDocs}, items changed: ${imp.updatedItems}`)

    console.log('\nNote: script removed `section` properties from the touched documents.\nPlease inspect sample documents to verify correctness.')
    process.exit(0)
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('migrate-remove-section.js')) {
  run()
}
