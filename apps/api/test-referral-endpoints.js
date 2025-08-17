// Simple test to check if referral endpoints are accessible
const API_BASE = 'http://localhost:3001/api'

async function testEndpoints() {
  console.log('🧪 Testing Referral Endpoints Accessibility...\n')

  const endpoints = [
    { method: 'POST', path: '/referrals', description: 'Create referral' },
    { method: 'GET', path: '/referrals/search', description: 'Search referrals' },
    { method: 'GET', path: '/referrals/stats', description: 'Get referral stats' },
    { method: 'GET', path: '/referrals/sent', description: 'Get sent referrals' },
    { method: 'GET', path: '/referrals/received', description: 'Get received referrals' }
  ]

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.method} ${endpoint.path} - ${endpoint.description}`)
      
      const response = await fetch(`${API_BASE}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 401) {
        console.log('✅ Endpoint accessible (returns 401 - authentication required as expected)')
      } else if (response.status === 404) {
        console.log('❌ Endpoint not found (404)')
      } else {
        console.log(`ℹ️  Endpoint returns status: ${response.status}`)
      }
    } catch (error) {
      console.log(`❌ Error testing endpoint: ${error.message}`)
    }
    console.log('')
  }

  // Test API documentation
  console.log('Testing API documentation...')
  try {
    const docsResponse = await fetch('http://localhost:3001/docs')
    if (docsResponse.ok) {
      console.log('✅ API documentation accessible at http://localhost:3001/docs')
    } else {
      console.log('❌ API documentation not accessible')
    }
  } catch (error) {
    console.log(`❌ Error accessing docs: ${error.message}`)
  }

  console.log('\n🏁 Endpoint accessibility test completed!')
}

testEndpoints()