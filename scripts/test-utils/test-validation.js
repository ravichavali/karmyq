/**
 * Test Zod validation for ride request
 */

const { validateRequest } = require('./packages/shared/utils/response.ts')

const testData = {
  request_type: 'ride',
  title: 'Need a ride from SFO to SJC',
  description: 'Need a ride from SFO to SJC',
  urgency: 'medium',
  payload: {
    origin: {
      address: 'SFO',
      lat: 0,
      lng: 0
    },
    destination: {
      address: 'SJC',
      lat: 0,
      lng: 0
    },
    seats_needed: 1,
    departure_time: '2025-12-26T23:30:00.000Z'
  }
}

console.log('Testing validation...')
console.log('Input data:', JSON.stringify(testData, null, 2))
console.log('\n---\n')

const result = validateRequest(testData)

if (result.success) {
  console.log('✅ VALIDATION PASSED')
  console.log('Validated data:', JSON.stringify(result.data, null, 2))
} else {
  console.log('❌ VALIDATION FAILED')
  console.log('Errors:', JSON.stringify(result.error.format(), null, 2))
}
