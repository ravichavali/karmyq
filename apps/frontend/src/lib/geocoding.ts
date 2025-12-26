/**
 * Geocoding Service - Address lookup using OpenStreetMap Nominatim
 * Free, open-source alternative to Google Places API
 *
 * Features:
 * - Client-side caching (24 hour TTL)
 * - Rate limiting (1 req/sec)
 * - Error handling and fallbacks
 * - Input validation and sanitization
 */

import { cache, createCacheKey } from './cache'

export interface AddressSuggestion {
  display_name: string
  address: string
  lat: number
  lng: number
  type: string // e.g., 'airport', 'city', 'street'
}

// Rate limiting
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 1000 // 1 second between requests

/**
 * Search for addresses using OpenStreetMap Nominatim
 * Rate limit: 1 request per second for free tier
 * Caches results for 24 hours
 */
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  // Input validation
  if (!query || query.length < 3) return []

  // Sanitize input (prevent injection attacks)
  const sanitized = query.trim().slice(0, 200) // Max 200 chars
  if (!/^[a-zA-Z0-9\s,.-]+$/.test(sanitized)) {
    console.warn('Invalid characters in search query')
    return []
  }

  // Check cache first
  const cacheKey = createCacheKey('geocode', sanitized.toLowerCase())
  const cached = await cache.get<AddressSuggestion[]>(cacheKey)
  if (cached) {
    console.debug(`Cache hit for geocoding: ${sanitized}`)
    return cached
  }

  // Rate limiting
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest
    console.debug(`Rate limiting: waiting ${delay}ms`)
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  lastRequestTime = Date.now()

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
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }
    )

    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status} ${response.statusText}`)
      return []
    }

    const results = await response.json()

    if (!Array.isArray(results)) {
      console.error('Geocoding API returned non-array response')
      return []
    }

    const suggestions: AddressSuggestion[] = results.map((result: any) => ({
      display_name: result.display_name || 'Unknown location',
      address: result.display_name?.split(',')[0] || sanitized,
      lat: parseFloat(result.lat) || 0,
      lng: parseFloat(result.lon) || 0,
      type: result.type || 'place'
    }))

    // Cache the results (24 hours)
    await cache.set(cacheKey, suggestions, 24 * 60 * 60 * 1000)
    console.debug(`Cached geocoding results for: ${sanitized}`)

    return suggestions
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Geocoding request timed out')
      } else {
        console.error('Geocoding error:', error.message)
      }
    } else {
      console.error('Unknown geocoding error:', error)
    }
    return []
  }
}

/**
 * Debounce helper for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Get common location suggestions (airports, landmarks, etc.)
 */
export function getCommonLocations(query: string): AddressSuggestion[] {
  const common = [
    { display_name: 'San Francisco International Airport (SFO)', address: 'SFO Airport', lat: 37.6213, lng: -122.3790, type: 'airport' },
    { display_name: 'San Jose International Airport (SJC)', address: 'SJC Airport', lat: 37.3639, lng: -121.9289, type: 'airport' },
    { display_name: 'Oakland International Airport (OAK)', address: 'OAK Airport', lat: 37.7213, lng: -122.2208, type: 'airport' },
    { display_name: 'Downtown San Francisco', address: 'Downtown SF', lat: 37.7875, lng: -122.4081, type: 'city' },
    { display_name: 'Downtown Oakland', address: 'Downtown Oakland', lat: 37.8044, lng: -122.2712, type: 'city' },
    { display_name: 'Downtown San Jose', address: 'Downtown SJ', lat: 37.3382, lng: -121.8863, type: 'city' },
  ]

  if (!query) return common.slice(0, 3)

  return common.filter(loc =>
    loc.display_name.toLowerCase().includes(query.toLowerCase()) ||
    loc.address.toLowerCase().includes(query.toLowerCase())
  )
}
