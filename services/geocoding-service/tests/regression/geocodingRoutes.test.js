const request = require('supertest')
const { createApp } = require('../../src/geocodingApp')

describe('geocoding routes', () => {
  test('GET /search rejects invalid query with ADR-074 error envelope', async () => {
    const app = createApp({ pool: {}, fetchImpl: jest.fn() })

    const res = await request(app).get('/search?q=s').expect(400)

    expect(res.body).toEqual({
      success: false,
      message: 'Query must be at least 2 characters',
      error: 'INVALID_QUERY',
    })
  })
})
