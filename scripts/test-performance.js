/**
 * Performance test for the marksheets API
 * Tests the GET /api/marksheets endpoint with various query parameters
 */

async function testMarksheetPerformance() {
  const baseUrl = process.env.API_URL || 'http://localhost:3000'
  
  const testCases = [
    {
      name: 'Query by staffId with multiple statuses',
      url: `${baseUrl}/api/marksheets?staffId=690cbf205b26bb0468a95f7d&status=verified_by_staff,dispatch_requested,rescheduled_by_hod,approved_by_hod,rejected_by_hod,dispatched`
    },
    {
      name: 'Query by department and status',
      url: `${baseUrl}/api/marksheets?department=CSE&status=verified_by_staff`
    },
    {
      name: 'Query by year',
      url: `${baseUrl}/api/marksheets?year=III`
    },
    {
      name: 'Query all marksheets (limited)',
      url: `${baseUrl}/api/marksheets`
    }
  ]

  console.log('🔍 Performance Testing - Marksheets API\n')
  console.log('=' .repeat(60))

  for (const testCase of testCases) {
    console.log(`\n📊 Test: ${testCase.name}`)
    console.log(`🔗 URL: ${testCase.url}`)
    
    const times = []
    const iterations = 5

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now()
      
      try {
        const response = await fetch(testCase.url)
        const endTime = Date.now()
        const duration = endTime - startTime
        
        if (!response.ok) {
          console.log(`   ❌ Request ${i + 1} failed: ${response.status} ${response.statusText}`)
          continue
        }
        
        const data = await response.json()
        times.push(duration)
        
        console.log(`   ✓ Request ${i + 1}: ${duration}ms (${data.marksheets?.length || 0} records)`)
      } catch (error) {
        console.log(`   ❌ Request ${i + 1} error: ${error.message}`)
      }
    }

    if (times.length > 0) {
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      const min = Math.min(...times)
      const max = Math.max(...times)
      
      console.log(`\n   📈 Results:`)
      console.log(`      Average: ${avg}ms`)
      console.log(`      Min: ${min}ms`)
      console.log(`      Max: ${max}ms`)
      
      if (avg < 100) {
        console.log(`      ⚡ Excellent! (< 100ms)`)
      } else if (avg < 200) {
        console.log(`      ✅ Good (100-200ms)`)
      } else if (avg < 500) {
        console.log(`      ⚠️  Acceptable (200-500ms)`)
      } else {
        console.log(`      🐌 Slow (> 500ms) - needs optimization`)
      }
    }
    
    console.log('\n' + '-'.repeat(60))
  }

  console.log('\n✅ Performance testing complete!\n')
}

// Run the tests
testMarksheetPerformance().catch(console.error)
