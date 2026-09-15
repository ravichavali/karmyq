/**
 * Sprint 130 PR B — CodeQL #540–#542 (js/log-injection), real findings.
 *
 * SAFE_ADDRESS_QUERY_PATTERN allows `\s`, and validation trims only the ends, so a query such as
 * "Main St\nFORGED 200 OK" passes validation. The cache HIT, cache MISS and "Cached N results" log
 * lines interpolated that RAW query, so a caller could write a forged log line.
 *
 * The fix logs the validated, normalised value. normalizeQuery already collapses every whitespace
 * run to one space and lowercases, and that cache-key contract must stay exactly as it is.
 */
const { createGeocodingService, normalizeQuery } = require('../../src/geocodingService')

const HOSTILE_QUERIES = [
  'Main St\nFORGED 200 OK',
  'Main St\r\nFORGED 200 OK',
  'Main St\u2028FORGED 200 OK',
]
const LINE_BREAK = /[\n\r\u2028\u2029]/

function captureLogger() {
  const lines = []
  const record = (...args) => lines.push(args.map(String).join(' '))
  return { lines, logger: { log: record, warn: record, error: record } }
}

function nominatimReturning(results) {
  return jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(results) })
}

const NOMINATIM_ROW = { display_name: 'Main St, Portland', lat: '45.5', lon: '-122.6', type: 'road' }

describe('geocoding search logs never carry a caller-supplied line break', () => {
  test.each(HOSTILE_QUERIES)('cache miss + cached results: %j', async (query) => {
    const { lines, logger } = captureLogger()
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) }
    const service = createGeocodingService({
      pool, fetchImpl: nominatimReturning([NOMINATIM_ROW]), logger, throttleIntervalMs: 0,
    })

    const result = await service.search(query)

    expect(result.ok).toBe(true)
    expect(result.data).toMatchObject({ source: 'nominatim', cached: false })
    // Both the MISS line and the "Cached 1 results" line were written.
    expect(lines.some(l => l.startsWith('Cache MISS for:'))).toBe(true)
    expect(lines.some(l => l.startsWith('Cached 1 results for:'))).toBe(true)
    expect(lines.filter(l => LINE_BREAK.test(l))).toEqual([])
  })

  test.each(HOSTILE_QUERIES)('cache hit: %j', async (query) => {
    const { lines, logger } = captureLogger()
    const pool = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ results: [NOMINATIM_ROW], hit_count: 3 }] })
        .mockResolvedValue({ rows: [] }),
    }
    const fetchImpl = jest.fn()
    const service = createGeocodingService({ pool, fetchImpl, logger, throttleIntervalMs: 0 })

    const result = await service.search(query)

    expect(result.data).toMatchObject({ source: 'cache', cached: true })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(lines).toEqual(['Cache HIT for: "main st forged 200 ok" (hits: 4)'])
  })
})

describe('the cache-key contract is unchanged', () => {
  test('normalizeQuery still lowercases and collapses whitespace', () => {
    expect(normalizeQuery('Main St\nFORGED 200 OK')).toBe('main st forged 200 ok')
    expect(normalizeQuery('  Main   St  Portland ')).toBe('main st portland')
  })

  test.each(HOSTILE_QUERIES)('every pool query for %j is keyed by the normalised value', async (query) => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) }
    const service = createGeocodingService({
      pool, fetchImpl: nominatimReturning([NOMINATIM_ROW]), logger: captureLogger().logger, throttleIntervalMs: 0,
    })

    await service.search(query)

    const keys = pool.query.mock.calls.map(([, params]) => params[0])
    expect(keys).toEqual(['main st forged 200 ok', 'main st forged 200 ok'])
  })

  test('a normal query keeps its results and logs', async () => {
    const { lines, logger } = captureLogger()
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) }
    const service = createGeocodingService({
      pool, fetchImpl: nominatimReturning([NOMINATIM_ROW]), logger, throttleIntervalMs: 0,
    })

    const result = await service.search('Main St Portland')

    expect(result.data.results).toEqual([
      { display_name: 'Main St, Portland', address: 'Main St', lat: 45.5, lng: -122.6, type: 'road' },
    ])
    expect(lines).toEqual([
      'Cache MISS for: "main st portland" - calling Nominatim API',
      'Cached 1 results for: "main st portland"',
    ])
  })
})
