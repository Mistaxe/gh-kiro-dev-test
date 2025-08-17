// Test script for referral workflow
// This tests the complete referral CRUD operations

const API_BASE = 'http://localhost:3001/api'

// Mock JWT token for testing (replace with actual token)
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzM0NzQ0NDk0LCJpYXQiOjE3MzQ3NDA4OTQsImlzcyI6Imh0dHBzOi8vdGlmeXFlZHpudHd2aWhueW9wbWwuc3VwYWJhc2UuY28vYXV0aC92MSIsInN1YiI6IjEyMzQ1Njc4LTkwYWItY2RlZi0xMjM0LTU2Nzg5MGFiY2RlZiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnt9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzM0NzQwODk0fV0sInNlc3Npb25faWQiOiIxMjM0NTY3OC05MGFiLWNkZWYtMTIzNC01Njc4OTBhYmNkZWYifQ.test-signature'

async function testReferralWorkflow() {
  console.log('🧪 Testing Referral Workflow...\n')

  try {
    // Test 1: Create a referral
    console.log('1️⃣ Testing referral creation...')
    const createResponse = await fetch(`${API_BASE}/referrals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'X-Purpose-Of-Use': 'care'
      },
      body: JSON.stringify({
        to_location_id: '12345678-90ab-cdef-1234-567890abcdef',
        title: 'Behavioral Health Referral',
        description: 'Client needs mental health services for anxiety and depression',
        urgency: 'routine',
        referral_type: 'direct',
        visibility_scope: 'organization'
      })
    })

    if (createResponse.ok) {
      const createResult = await createResponse.json()
      console.log('✅ Referral created successfully:', createResult.id)
      
      // Test 2: Search referrals
      console.log('\n2️⃣ Testing referral search...')
      const searchResponse = await fetch(`${API_BASE}/referrals/search?limit=10`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'X-Purpose-Of-Use': 'care'
        }
      })

      if (searchResponse.ok) {
        const searchResult = await searchResponse.json()
        console.log('✅ Search successful, found', searchResult.total_count, 'referrals')
        
        if (searchResult.referrals.length > 0) {
          const referral = searchResult.referrals[0]
          console.log('   Sample referral:', {
            id: referral.id,
            title: referral.title,
            status: referral.status,
            urgency: referral.urgency
          })

          // Test 3: Get specific referral
          console.log('\n3️⃣ Testing get specific referral...')
          const getResponse = await fetch(`${API_BASE}/referrals/${referral.id}`, {
            headers: {
              'Authorization': `Bearer ${TEST_TOKEN}`,
              'X-Purpose-Of-Use': 'care'
            }
          })

          if (getResponse.ok) {
            const getReferral = await getResponse.json()
            console.log('✅ Get referral successful:', getReferral.title)
          } else {
            console.log('❌ Get referral failed:', getResponse.status, await getResponse.text())
          }

          // Test 4: Update referral
          console.log('\n4️⃣ Testing referral update...')
          const updateResponse = await fetch(`${API_BASE}/referrals/${referral.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TEST_TOKEN}`,
              'X-Purpose-Of-Use': 'care'
            },
            body: JSON.stringify({
              title: 'Updated Behavioral Health Referral',
              urgency: 'urgent'
            })
          })

          if (updateResponse.ok) {
            console.log('✅ Referral updated successfully')
          } else {
            console.log('❌ Update failed:', updateResponse.status, await updateResponse.text())
          }
        }
      } else {
        console.log('❌ Search failed:', searchResponse.status, await searchResponse.text())
      }

      // Test 5: Get referral statistics
      console.log('\n5️⃣ Testing referral statistics...')
      const statsResponse = await fetch(`${API_BASE}/referrals/stats`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`
        }
      })

      if (statsResponse.ok) {
        const stats = await statsResponse.json()
        console.log('✅ Statistics retrieved:', stats)
      } else {
        console.log('❌ Statistics failed:', statsResponse.status, await statsResponse.text())
      }

    } else {
      console.log('❌ Create failed:', createResponse.status, await createResponse.text())
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message)
  }

  console.log('\n🏁 Referral workflow test completed!')
}

// Run the test
testReferralWorkflow()