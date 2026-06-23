const DEFAULT_USER_AGENT = 'Karmyq/1.0 (mutual aid platform; https://karmyq.com)'
const SAFE_ADDRESS_QUERY_PATTERN = /^[\p{L}\p{N}\s,.'\u2019#\/&()/-]+$/u

function normalizeQuery(query) {
  return String(query || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function validateSearchQuery(query) {
  if (typeof query !== 'string') {
    return { ok: false, code: 'INVALID_QUERY', message: 'Query must be at least 2 characters' }
  }

  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return { ok: false, code: 'INVALID_QUERY', message: 'Query must be at least 2 characters' }
  }

  const sanitized = trimmed.slice(0, 200)
  if (!SAFE_ADDRESS_QUERY_PATTERN.test(sanitized)) {
    return { ok: false, code: 'INVALID_QUERY', message: 'Query contains unsupported characters' }
  }

  return { ok: true, value: normalizeQuery(sanitized) }
}

function createExternalThrottle(intervalMs) {
  let lastRun = 0
  let chain = Promise.resolve()

  return function throttled(fn) {
    const run = chain.catch(() => undefined).then(async () => {
      const elapsed = Date.now() - lastRun
      if (lastRun > 0 && elapsed < intervalMs) {
        await new Promise(resolve => setTimeout(resolve, intervalMs - elapsed))
      }

      lastRun = Date.now()
      return fn()
    })

    chain = run.catch(() => undefined)
    return run
  }
}

async function callNominatimAPI(fetchImpl, query, logger = console) {
  if (typeof query !== 'string') return []

  const validation = validateSearchQuery(query)
  if (!validation.ok) {
    logger.warn?.('Invalid characters in search query')
    return []
  }

  const sanitized = validation.value

  try {
    const response = await fetchImpl(
      `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(sanitized)}` +
        `&format=json` +
        `&limit=5` +
        `&addressdetails=1`,
      {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
        },
        timeout: 5000,
      }
    )

    if (!response.ok) {
      logger.error?.(`Nominatim API error: ${response.status}`)
      return []
    }

    const results = await response.json()
    if (!Array.isArray(results)) return []

    return results.map(result => ({
      display_name: result.display_name || 'Unknown location',
      address: result.display_name?.split(',')[0] || sanitized,
      lat: parseFloat(result.lat) || 0,
      lng: parseFloat(result.lon) || 0,
      type: result.type || 'place',
    }))
  } catch (error) {
    logger.error?.('Nominatim API call failed:', error.message)
    return []
  }
}

function createGeocodingService({ pool, fetchImpl, logger = console, throttleIntervalMs = 1000 }) {
  const throttleExternal = createExternalThrottle(throttleIntervalMs)

  async function search(query) {
    const validation = validateSearchQuery(query)
    if (!validation.ok) return validation

    const normalized = validation.value
    const cached = await pool.query(
      'SELECT results, hit_count FROM geocoding_cache WHERE query = $1 AND expires_at > NOW()',
      [normalized]
    )

    if (cached.rows.length > 0) {
      await pool.query(
        'UPDATE geocoding_cache SET hit_count = hit_count + 1, last_accessed = NOW() WHERE query = $1',
        [normalized]
      )
      logger.log?.(`Cache HIT for: "${query}" (hits: ${Number(cached.rows[0].hit_count || 0) + 1})`)
      return {
        ok: true,
        data: { results: cached.rows[0].results, source: 'cache', cached: true },
      }
    }

    logger.log?.(`Cache MISS for: "${query}" - calling Nominatim API`)
    const apiResults = await throttleExternal(() => callNominatimAPI(fetchImpl, normalized, logger))

    if (apiResults.length > 0) {
      await pool.query(
        `INSERT INTO geocoding_cache (query, results)
         VALUES ($1, $2)
         ON CONFLICT (query) DO UPDATE
         SET results = $2, hit_count = geocoding_cache.hit_count + 1, last_accessed = NOW()`,
        [normalized, JSON.stringify(apiResults)]
      )
      logger.log?.(`Cached ${apiResults.length} results for: "${query}"`)
    }

    return {
      ok: true,
      data: { results: apiResults, source: 'nominatim', cached: false },
    }
  }

  async function cache(query, results) {
    const validation = validateSearchQuery(query)
    if (!validation.ok) return validation

    if (!Array.isArray(results)) {
      return { ok: false, code: 'INVALID_RESULTS', message: 'Results must be an array' }
    }

    await pool.query(
      `INSERT INTO geocoding_cache (query, results)
       VALUES ($1, $2)
       ON CONFLICT (query) DO UPDATE
       SET results = $2, cached_at = NOW(), expires_at = NOW() + INTERVAL '30 days'`,
      [validation.value, JSON.stringify(results)]
    )

    return { ok: true, data: { query: validation.value } }
  }

  async function stats() {
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_entries,
        SUM(hit_count) as total_hits,
        COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries,
        COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
        AVG(hit_count)::INTEGER as avg_hit_count,
        MAX(hit_count) as max_hit_count
      FROM geocoding_cache
    `)

    const topQueries = await pool.query(`
      SELECT query, hit_count, last_accessed
      FROM geocoding_cache
      WHERE expires_at > NOW()
      ORDER BY hit_count DESC
      LIMIT 10
    `)

    return { stats: statsResult.rows[0], top_queries: topQueries.rows }
  }

  async function cleanup() {
    const result = await pool.query('DELETE FROM geocoding_cache WHERE expires_at <= NOW()')
    return { deleted: result.rowCount }
  }

  return { search, cache, stats, cleanup }
}

module.exports = {
  DEFAULT_USER_AGENT,
  SAFE_ADDRESS_QUERY_PATTERN,
  normalizeQuery,
  validateSearchQuery,
  createExternalThrottle,
  callNominatimAPI,
  createGeocodingService,
}
