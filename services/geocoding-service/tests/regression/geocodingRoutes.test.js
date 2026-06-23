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

  test('GET /search returns cached result without calling external geocoder', async () => {
    const pool = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            results: [{ display_name: 'Oakland', lat: 37.8, lng: -122.2, type: 'city' }],
            hit_count: 2,
          }],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    }
    const fetchImpl = jest.fn()
    const app = createApp({ pool, fetchImpl, logger: { error: jest.fn(), log: jest.fn() } })

    const res = await request(app).get('/search?q=Oakland').expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.cached).toBe(true)
    expect(res.body.data.source).toBe('cache')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('GET /search recovers after a transient external geocoder rejection', async () => {
    const pool = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    }
    const fetchImpl = jest.fn()
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ display_name: 'Berkeley, CA', lat: '37.8715', lon: '-122.2730', type: 'city' }],
      })
    const app = createApp({
      pool,
      fetchImpl,
      logger: { error: jest.fn(), log: jest.fn() },
      throttleIntervalMs: 0,
    })

    const first = await request(app).get('/search?q=Oakland').expect(200)
    expect(first.body.data.results).toEqual([])

    const second = await request(app).get('/search?q=Berkeley').expect(200)
    expect(second.body.data.results[0].address).toBe('Berkeley')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
