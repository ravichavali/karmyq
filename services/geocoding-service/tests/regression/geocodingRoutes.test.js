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

  test('GET /search checks cache for real address punctuation and accents', async () => {
    const pool = {
      query: jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            results: [{ display_name: "Café Réveille #2/3", lat: 37.8, lng: -122.2, type: 'cafe' }],
            hit_count: 1,
          }],
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    }
    const fetchImpl = jest.fn()
    const app = createApp({ pool, fetchImpl, logger: { error: jest.fn(), log: jest.fn() } })

    const res = await request(app).get('/search').query({ q: "Café Réveille #2/3" }).expect(200)

    expect(res.body.success).toBe(true)
    expect(res.body.data.cached).toBe(true)
    expect(res.body.data.results[0].display_name).toBe('Café Réveille #2/3')
    expect(pool.query.mock.calls[0][1]).toEqual(['café réveille #2/3'])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  // Sprint 122: express 4 -> 5. These pin the two things the upgrade could break in this
  // service, which is plain JS and therefore gets no `tsc` coverage: that `express.json()`
  // (body-parser 2.x under express 5) still delivers a POST body to the handler, and that
  // path-to-regexp 8 still builds the route table.
  test('POST /cache: express.json() delivers the body all the way to pool.query', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }
    const app = createApp({ pool, fetchImpl: jest.fn(), logger: { error: jest.fn(), log: jest.fn() } })
    const results = [{ display_name: 'Oakland', lat: 37.8, lng: -122.2, type: 'city' }]

    const res = await request(app).post('/cache').send({ query: 'Oakland', results }).expect(200)

    expect(res.body).toEqual({
      success: true,
      data: { query: 'oakland' },
      message: 'Cached results for: oakland',
    })
    // The body-parser proof: the parsed values, not defaults, reached the service layer.
    expect(pool.query).toHaveBeenCalledTimes(1)
    expect(pool.query.mock.calls[0][1]).toEqual(['oakland', JSON.stringify(results)])
  })

  test('GET /health returns 200 (route table built by path-to-regexp 8)', async () => {
    const app = createApp({ pool: {}, fetchImpl: jest.fn() })
    const res = await request(app).get('/health').expect(200)
    expect(res.body.status).toBe('healthy')
    expect(res.body.service).toBe('geocoding-cache')
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
