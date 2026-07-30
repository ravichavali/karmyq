const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { sendSuccess, sendError } = require('./response')
const { createGeocodingService } = require('./geocodingService')

function createApp({
  pool,
  fetchImpl,
  logger = console,
  allowedOrigins = ['http://localhost:3000'],
  throttleIntervalMs = 1000,
} = {}) {
  const app = express()
  const service = createGeocodingService({ pool, fetchImpl, logger, throttleIntervalMs })
  const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false })
  const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false })

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
  // Express 5 leaves req.body undefined when no body was sent, where Express 4 defaulted it
  // to {}. POST /cache reads req.body.query, which would throw on a bodyless request. Declared
  // inline rather than via @karmyq/shared's normalizeRequestBody: this service is plain JS and
  // does not consume the shared package. Must follow express.json().
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {}
    next()
  })

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'geocoding-cache', port: process.env.PORT || 3009 })
  })

  app.get('/search', searchLimiter, async (req, res) => {
    try {
      const result = await service.search(req.query.q)
      if (!result.ok) return sendError(res, 400, result.code, result.message)
      return sendSuccess(res, result.data)
    } catch (error) {
      logger.error?.('Geocoding search error:', error)
      return sendError(res, 500, 'GEOCODING_SEARCH_FAILED', 'Failed to search addresses')
    }
  })

  app.post('/cache', writeLimiter, async (req, res) => {
    try {
      const result = await service.cache(req.body.query, req.body.results)
      if (!result.ok) return sendError(res, 400, result.code, result.message)
      return sendSuccess(res, result.data, `Cached results for: ${result.data.query}`)
    } catch (error) {
      logger.error?.('Cache insert error:', error)
      return sendError(res, 500, 'GEOCODING_CACHE_FAILED', 'Failed to cache address results')
    }
  })

  app.get('/stats', searchLimiter, async (req, res) => {
    try {
      return sendSuccess(res, await service.stats())
    } catch (error) {
      logger.error?.('Stats error:', error)
      return sendError(res, 500, 'GEOCODING_STATS_FAILED', 'Failed to load geocoding cache stats')
    }
  })

  app.post('/cleanup', writeLimiter, async (req, res) => {
    try {
      const data = await service.cleanup()
      return sendSuccess(res, data, `Deleted ${data.deleted} expired cache entries`)
    } catch (error) {
      logger.error?.('Cleanup error:', error)
      return sendError(res, 500, 'GEOCODING_CLEANUP_FAILED', 'Failed to clean up expired cache entries')
    }
  })

  return app
}

module.exports = { createApp }
