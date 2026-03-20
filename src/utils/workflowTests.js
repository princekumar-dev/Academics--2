/**
 * Marksheet Workflow Verification Tests
 * Tests the complete workflow: Import → Staff Verify → HOD Verify → Dispatch → PDF Generation
 */

import apiClient from '../utils/apiClient'

const WORKFLOW_STAGES = {
  IMPORTED: 'imported',
  VERIFIED_BY_STAFF: 'verified_by_staff',
  VERIFIED_BY_HOD: 'verified_by_hod',
  DISPATCHED: 'dispatched'
}

/**
 * Test 1: Verify marksheet import created records properly
 */
export const testImportWorkflow = async () => {
  try {
    console.log('🔍 Testing Import Workflow...')
    
    // Get recent marksheets (should be in 'imported' status)
    const response = await apiClient.get('/api/marksheets?sort=-createdAt&limit=1')
    
    if (!response.success || !response.marksheets || response.marksheets.length === 0) {
      return { success: false, error: 'No marksheets found' }
    }

    const marksheet = response.marksheets[0]
    
    const checks = {
      hasId: !!marksheet._id,
      hasStudentId: !!marksheet.studentId,
      hasExaminationName: !!marksheet.examinationName,
      hasStatus: !!marksheet.status,
      hasStudentDetails: !!marksheet.studentDetails,
      hasMarks: marksheet.marks && Object.keys(marksheet.marks).length > 0,
      statusIsImported: marksheet.status === WORKFLOW_STAGES.IMPORTED
    }

    const allPassed = Object.values(checks).every(v => v === true)
    
    return {
      success: allPassed,
      checks,
      marksheet: {
        id: marksheet._id,
        studentName: marksheet.studentDetails?.name,
        examinationName: marksheet.examinationName,
        status: marksheet.status
      }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Test 2: Verify staff can fetch their marksheets
 */
export const testStaffFetchWorkflow = async (staffId) => {
  try {
    console.log('🔍 Testing Staff Fetch Workflow...')
    
    const response = await apiClient.get(`/api/marksheets?staffId=${staffId}&sort=-createdAt&limit=10`)
    
    if (!response.success) {
      return { success: false, error: 'Failed to fetch staff marksheets' }
    }

    const checks = {
      hasPagination: !!response.pagination,
      hasMarksheets: response.marksheets && response.marksheets.length > 0,
      paginationComplete: response.pagination?.currentPage && response.pagination?.totalPages,
      allBelongToStaff: response.marksheets?.every(m => m.staffId === staffId)
    }

    const allPassed = Object.values(checks).every(v => v === true)

    return {
      success: allPassed,
      checks,
      count: response.marksheets?.length || 0,
      pagination: response.pagination
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Test 3: Verify staff can mark a marksheet as verified
 */
export const testStaffVerifyWorkflow = async (marksheetId, staffSignature) => {
  try {
    console.log('🔍 Testing Staff Verify Workflow...')
    
    if (!staffSignature) {
      return { success: false, error: 'Staff signature not provided. Please upload signature in Settings.' }
    }

    const response = await apiClient.post('/api/marksheets/verify', {
      marksheetId,
      staffSignature // Should be base64 image data
    })

    if (!response.success) {
      return { success: false, error: response.error || 'Verify failed' }
    }

    const checks = {
      statusIsVerifiedByStaff: response.marksheet?.status === WORKFLOW_STAGES.VERIFIED_BY_STAFF,
      hasStaffSignature: !!response.marksheet?.staffSignature,
      staffNamePreserved: !!response.marksheet?.staffName,
      verifyTimestamp: !!response.marksheet?.verifiedAt
    }

    const allPassed = Object.values(checks).every(v => v === true)

    return {
      success: allPassed,
      checks,
      marksheet: {
        id: response.marksheet?._id,
        status: response.marksheet?.status,
        staffName: response.marksheet?.staffName,
        hasSignature: !!response.marksheet?.staffSignature
      }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Test 4: Verify HOD can fetch their pending marksheets
 */
export const testHODFetchWorkflow = async (department) => {
  try {
    console.log('🔍 Testing HOD Fetch Workflow...')
    
    const response = await apiClient.get(
      `/api/marksheets?department=${department}&status=${WORKFLOW_STAGES.VERIFIED_BY_STAFF}&sort=-createdAt&limit=10`
    )

    if (!response.success) {
      return { success: false, error: 'Failed to fetch HOD marksheets' }
    }

    const checks = {
      hasPagination: !!response.pagination,
      hasMarksheets: response.marksheets && response.marksheets.length > 0,
      allVerifiedByStaff: response.marksheets?.every(m => m.status === WORKFLOW_STAGES.VERIFIED_BY_STAFF),
      departmentMatch: response.marksheets?.every(m => m.studentDetails?.department === department)
    }

    const allPassed = Object.values(checks).every(v => v === true)

    return {
      success: allPassed,
      checks,
      count: response.marksheets?.length || 0
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Test 5: Verify HOD can mark marksheets as verified
 */
export const testHODVerifyWorkflow = async (marksheetId, hodSignature, hodName) => {
  try {
    console.log('🔍 Testing HOD Verify Workflow...')
    
    if (!hodSignature) {
      return { success: false, error: 'HOD signature not provided. Please upload signature in Settings.' }
    }

    const response = await apiClient.post('/api/marksheets/hod-verify', {
      marksheetId,
      hodSignature,
      hodName
    })

    if (!response.success) {
      return { success: false, error: response.error || 'HOD verify failed' }
    }

    const checks = {
      statusIsVerifiedByHOD: response.marksheet?.status === WORKFLOW_STAGES.VERIFIED_BY_HOD,
      hasHODSignature: !!response.marksheet?.hodSignature,
      hodNamePreserved: response.marksheet?.hodName === hodName,
      staffSignaturePreserved: !!response.marksheet?.staffSignature
    }

    const allPassed = Object.values(checks).every(v => v === true)

    return {
      success: allPassed,
      checks,
      marksheet: {
        id: response.marksheet?._id,
        status: response.marksheet?.status,
        hodName: response.marksheet?.hodName,
        hasHODSignature: !!response.marksheet?.hodSignature,
        hasStaffSignature: !!response.marksheet?.staffSignature
      }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Test 6: Verify dispatch can be initiated
 */
export const testDispatchWorkflow = async (marksheetIds) => {
  try {
    console.log('🔍 Testing Dispatch Workflow...')
    
    if (!Array.isArray(marksheetIds) || marksheetIds.length === 0) {
      return { success: false, error: 'No marksheet IDs provided' }
    }

    const response = await apiClient.post('/api/marksheets/dispatch', {
      marksheetIds,
      medium: 'whatsapp' // or 'email'
    })

    if (!response.success) {
      return { success: false, error: response.error || 'Dispatch failed' }
    }

    const checks = {
      dispatchTriggered: response.success === true,
      hasDispatchInfo: !!response.dispatchInfo,
      isProcessing: response.isProcessing === true
    }

    const allPassed = Object.values(checks).every(v => v === true)

    return {
      success: allPassed,
      checks,
      dispatchInfo: response.dispatchInfo
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Test 7: Verify PDF generation with signatures
 */
export const testPDFGenerationWorkflow = async (marksheetId) => {
  try {
    console.log('🔍 Testing PDF Generation Workflow...')
    
    const response = await apiClient.get(`/api/marksheets/pdf/${marksheetId}`)

    if (!response.success) {
      return { success: false, error: response.error || 'PDF generation failed' }
    }

    const checks = {
      hasPDFData: !!response.pdfData || !!response.pdf,
      isBase64: typeof response.pdfData === 'string' || typeof response.pdf === 'string',
      canDownload: response.filename !== undefined
    }

    const allPassed = Object.values(checks).every(v => v === true)

    return {
      success: allPassed,
      checks,
      filename: response.filename,
      pdfSize: response.pdfData?.length || response.pdf?.length || 'unknown'
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Test 8: Complete end-to-end workflow test
 */
export const testCompleteWorkflow = async (testConfig) => {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  }

  const tests = [
    { name: 'Import Workflow', fn: testImportWorkflow },
    { 
      name: 'Staff Fetch Workflow', 
      fn: () => testStaffFetchWorkflow(testConfig.staffId),
      skip: !testConfig.staffId
    },
    { 
      name: 'Staff Verify Workflow', 
      fn: () => testStaffVerifyWorkflow(testConfig.marksheetId, testConfig.staffSignature),
      skip: !testConfig.marksheetId || !testConfig.staffSignature
    },
    { 
      name: 'HOD Fetch Workflow', 
      fn: () => testHODFetchWorkflow(testConfig.department),
      skip: !testConfig.department
    },
    { 
      name: 'HOD Verify Workflow', 
      fn: () => testHODVerifyWorkflow(testConfig.marksheetId, testConfig.hodSignature, testConfig.hodName),
      skip: !testConfig.marksheetId || !testConfig.hodSignature
    },
    { 
      name: 'Dispatch Workflow', 
      fn: () => testDispatchWorkflow([testConfig.marksheetId]),
      skip: !testConfig.marksheetId
    },
    { 
      name: 'PDF Generation Workflow', 
      fn: () => testPDFGenerationWorkflow(testConfig.marksheetId),
      skip: !testConfig.marksheetId
    }
  ]

  for (const test of tests) {
    results.summary.total++

    if (test.skip) {
      console.log(`⊘ Skipping: ${test.name} (missing config)`)
      continue
    }

    try {
      console.log(`Running: ${test.name}...`)
      const result = await test.fn()
      results.tests[test.name] = result

      if (result.success) {
        results.summary.passed++
        console.log(`✅ ${test.name}`)
      } else {
        results.summary.failed++
        console.log(`❌ ${test.name}: ${result.error}`)
      }
    } catch (err) {
      results.summary.failed++
      results.tests[test.name] = { success: false, error: err.message }
      console.log(`❌ ${test.name}: ${err.message}`)
    }
  }

  return results
}
