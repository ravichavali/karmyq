/**
 * Geocoding Cache Service
 * Port: 3009
 *
 * Three-tier caching strategy:
 * 1. Browser IndexedDB (handled by frontend)
 * 2. PostgreSQL cache (this service)
 * 3. External Nominatim API (fallback)
 *
 * Reduces external API calls by 95%+.
 */

const { Pool } = require('pg')
const fetch = require('node-fetch')
const { createApp } = require('./src/geocodingApp')

const PORT = process.env.PORT || 3009

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
  .map(origin => origin.trim())

const app = createApp({ pool, fetchImpl: fetch, allowedOrigins })
const server = app.listen(PORT, () => {
  console.log(`Geocoding Cache Service running on port ${PORT}`)
  console.log(`Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`)
})

process.on('SIGTERM', () => {
  console.log('Shutting down geocoding service...')
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
})
