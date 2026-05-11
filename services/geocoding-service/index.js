/**
 * Geocoding Cache Service
 * Port: 3009
 *
 * Three-tier caching strategy:
 * 1. Browser IndexedDB (handled by frontend)
 * 2. PostgreSQL cache (this service)
 * 3. External Nominatim API (fallback)
 *
 * Reduces external API calls by 95%+
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { Pool } = require('pg')
const fetch = require('node-fetch')

// Rate limiters — generous for autocomplete use case, tighter for writes
const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false })
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false })

const app = express()
const PORT = process.env.PORT || 3009

// Database connection - supports DATABASE_URL (production) or individual DB_* vars (development)
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: 5,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'karmyq',
      user: process.env.DB_USER || 'karmyq_user',
      password: process.env.DB_PASSWORD || 'karmyq_password_dev',
      max: 5,
    }
const pool = new Pool(poolConfig)

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())

// Middleware
app.use(helmet())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  credentials: true,
}))
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'geocoding-cache', port: PORT })
})

// Search geocoding cache
app.get('/search', searchLimiter, async (req, res) => {
  const { q } = req.query

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' })
  }

  const normalized = q.toLowerCase().trim()

  try {
    // Check PostgreSQL cache
    const result = await pool.query(
      'SELECT results, hit_count FROM geocoding_cache WHERE query = $1 AND expires_at > NOW()',
      [normalized]
    )

    if (result.rows.length > 0) {
      // Cache hit! Update stats
      await pool.query(
        'UPDATE geocoding_cache SET hit_count = hit_count + 1, last_accessed = NOW() WHERE query = $1',
        [normalized]
      )

      console.log(`✅ Cache HIT for: "${q}" (hits: ${result.rows[0].hit_count + 1})`)
      return res.json({
        results: result.rows[0].results,
        source: 'cache',
        cached: true
      })
    }

    // Cache miss - call external API
    console.log(`⚠️ Cache MISS for: "${q}" - calling Nominatim API`)

    const apiResults = await callNominatimAPI(normalized)

    if (apiResults.length > 0) {
      // Cache the results
      await pool.query(
        `INSERT INTO geocoding_cache (query, results)
         VALUES ($1, $2)
         ON CONFLICT (query) DO UPDATE
         SET results = $2, hit_count = geocoding_cache.hit_count + 1, last_accessed = NOW()`,
        [normalized, JSON.stringify(apiResults)]
      )

      console.log(`✅ Cached ${apiResults.length} results for: "${q}"`)
    }

    res.json({
      results: apiResults,
      source: 'nominatim',
      cached: false
    })
  } catch (error) {
    console.error('Geocoding search error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Manually cache a result (for pre-seeding)
app.post('/cache', writeLimiter, async (req, res) => {
  const { query, results } = req.body

  if (!query || !results) {
    return res.status(400).json({ error: 'Query and results required' })
  }

  try {
    await pool.query(
      `INSERT INTO geocoding_cache (query, results)
       VALUES ($1, $2)
       ON CONFLICT (query) DO UPDATE
       SET results = $2, cached_at = NOW(), expires_at = NOW() + INTERVAL '30 days'`,
      [query.toLowerCase().trim(), JSON.stringify(results)]
    )

    res.json({ success: true, message: `Cached results for: ${query}` })
  } catch (error) {
    console.error('Cache insert error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get cache statistics
app.get('/stats', searchLimiter, async (req, res) => {
  try {
    const stats = await pool.query(`
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

    res.json({
      stats: stats.rows[0],
      top_queries: topQueries.rows
    })
  } catch (error) {
    console.error('Stats error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Cleanup expired entries
app.post('/cleanup', writeLimiter, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM geocoding_cache WHERE expires_at <= NOW()'
    )

    res.json({
      success: true,
      deleted: result.rowCount,
      message: `Deleted ${result.rowCount} expired cache entries`
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Call OpenStreetMap Nominatim API
 */
async function callNominatimAPI(query) {
  // Type guard: prevent type confusion if non-string passed
  if (typeof query !== 'string') return []
  // Input sanitization
  const sanitized = query.trim().slice(0, 200)
  if (!/^[a-zA-Z0-9\s,.-]+$/.test(sanitized)) {
    console.warn('Invalid characters in search query')
    return []
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(sanitized)}` +
      `&format=json` +
      `&limit=5` +
      `&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Karmyq/1.0 (mutual aid platform; https://karmyq.com)'
        },
        timeout: 5000
      }
    )

    if (!response.ok) {
      console.error(`Nominatim API error: ${response.status}`)
      return []
    }

    const results = await response.json()

    if (!Array.isArray(results)) {
      return []
    }

    return results.map((result) => ({
      display_name: result.display_name || 'Unknown location',
      address: result.display_name?.split(',')[0] || sanitized,
      lat: parseFloat(result.lat) || 0,
      lng: parseFloat(result.lon) || 0,
      type: result.type || 'place'
    }))
  } catch (error) {
    console.error('Nominatim API call failed:', error.message)
    return []
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`✅ Geocoding Cache Service running on port ${PORT}`)
  console.log(`🔹 Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`)
})

// Handle shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down geocoding service...')
  await pool.end()
  process.exit(0)
})
