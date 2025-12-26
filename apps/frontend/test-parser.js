/**
 * Quick test for request parser
 */

const { parseRequestDescription, buildPayloadFromParsed } = require('./src/lib/requestParser.ts')

// Test the exact input from the user (with all shortcuts)
const testInput = 'Need a ride from @SJC to @SFO @tomorrow 5:30PM #2 !urgent $0-50'
const requestType = 'ride'

console.log('Testing parser with input:', testInput)
console.log('Request type:', requestType)
console.log('\n---\n')

const parsed = parseRequestDescription(testInput, requestType)

console.log('Parsed result:')
console.log(JSON.stringify(parsed, null, 2))
console.log('\n---\n')

const payload = buildPayloadFromParsed(parsed, requestType)

console.log('Built payload:')
console.log(JSON.stringify(payload, null, 2))
console.log('\n---\n')

console.log('Final request that would be sent to backend:')
const finalRequest = {
  community_id: 'test-community-id',
  request_type: requestType,
  title: testInput.slice(0, 100),
  description: parsed.cleanDescription,
  urgency: parsed.extractedData.urgency || 'medium',
  payload: payload
}
console.log(JSON.stringify(finalRequest, null, 2))
console.log('\n---\n')

console.log('Validation Check:')
console.log('Title length:', finalRequest.title.length, '(min 5)')
console.log('Description length:', finalRequest.description.length, '(min 10)')
console.log('Payload keys:', Object.keys(finalRequest.payload))
