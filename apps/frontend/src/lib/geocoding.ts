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
const BACKEND_GEOCODING_TIMEOUT_MS = 6500
const SAFE_ADDRESS_QUERY_PATTERN = /^[\p{L}\p{N}\s,.'\u2019#\/&()/-]+$/u

function getBackendResults(responseBody: any): { results: AddressSuggestion[], cached?: boolean } {
  const payload = responseBody?.success && responseBody?.data ? responseBody.data : responseBody
  return {
    results: Array.isArray(payload?.results) ? payload.results : [],
    cached: payload?.cached,
  }
}

function isBackendTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    /timed?\s*out|aborted/i.test(error.message)
  )
}

/**
 * Search for addresses using local IndexedDB first, then the backend geocoding boundary.
 *
 * Priority:
 * 1. Check IndexedDB common locations (instant, ~5ms)
 * 2. Check IndexedDB API cache (instant, ~5ms)
 * 3. Check backend PostgreSQL cache / shared Nominatim boundary
 * 4. Check localStorage cache (legacy)
 * 5. Last-resort direct Nominatim fallback for backend reachability failures only
 */
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  // Input validation (minimum 2 chars to support airport codes like "SJ")
  if (!query || query.length < 2) return []

  // Sanitize input (prevent injection attacks)
  const sanitized = query.trim().slice(0, 200) // Max 200 chars
  if (!SAFE_ADDRESS_QUERY_PATTERN.test(sanitized)) {
    console.warn('Invalid characters in search query')
    return []
  }

  // STEP 1: Check IndexedDB common locations (airports, cities)
  const { searchCommonLocations, getCachedResult, cacheAPIResult } = await import('./geocodingCache')

  const commonResults = await searchCommonLocations(sanitized, 5)
  if (commonResults.length > 0) {
    console.debug(`✅ IndexedDB common locations hit for: ${sanitized}`)
    return commonResults
  }

  // STEP 2: Check IndexedDB API cache
  const indexedDBCached = await getCachedResult(sanitized)
  if (indexedDBCached && indexedDBCached.length > 0) {
    console.debug(`✅ Tier 1: IndexedDB API cache hit for: ${sanitized}`)
    return indexedDBCached
  }

  // STEP 3: Check backend PostgreSQL cache
  const geocodingApiUrl = process.env.NEXT_PUBLIC_GEOCODING_API_URL || 'http://localhost:3009'
  let backendTimedOut = false
  let backendAnswered = false
  let allowDirectExternalFallback = false

  try {
    const backendResponse = await fetch(
      `${geocodingApiUrl}/search?q=${encodeURIComponent(sanitized)}`,
      { signal: AbortSignal.timeout(BACKEND_GEOCODING_TIMEOUT_MS) }
    )

    backendAnswered = true
    if (backendResponse.ok) {
      const backendData = await backendResponse.json()
      const { results, cached } = getBackendResults(backendData)
      if (results.length > 0) {
        console.debug(`✅ Tier 2: Backend DB ${cached ? 'CACHE HIT' : 'API call'} for: ${sanitized}`)

        // Cache locally in IndexedDB for next time (even if it came from backend API call)
        await cacheAPIResult(sanitized, results)

        // If backend made an API call and got results, we're done (backend already cached it)
        return results
      }
    }
  } catch (error) {
    backendTimedOut = isBackendTimeout(error)
    allowDirectExternalFallback = !backendTimedOut
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const fallbackAction = backendTimedOut ? 'using local caches only' : 'falling back to direct API'
    console.warn(`⚠️ Backend geocoding unavailable (${errorMessage}), ${fallbackAction}`)
  }

  // STEP 4: Fallback to localStorage cache (legacy)
  const cacheKey = createCacheKey('geocode', sanitized.toLowerCase())
  const cached = await cache.get<AddressSuggestion[]>(cacheKey)
  if (cached) {
    console.debug(`✅ Tier 3: localStorage cache hit for: ${sanitized}`)
    return cached
  }

  if (backendTimedOut) {
    return []
  }

  // A resolved backend response means the shared policy boundary answered, even for 429/500.
  if (backendAnswered || !allowDirectExternalFallback) {
    return []
  }

  // STEP 5: Direct API call (only if all tiers failed)
  // Last-resort fallback only: the backend geocoding cache is the app-wide Nominatim policy boundary.
  // Keep local caches + backend cache ahead of direct public API calls.
  console.debug(`⚠️ Tier 4: Calling external Nominatim API for: ${sanitized}`)

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
      address: result.display_name || sanitized,
      lat: parseFloat(result.lat) || 0,
      lng: parseFloat(result.lon) || 0,
      type: result.type || 'place'
    }))

    // Cache everywhere (fire-and-forget, don't wait)
    void Promise.allSettled([
      // IndexedDB (local browser cache)
      cacheAPIResult(sanitized, suggestions),
      // Backend cache (shared across all users)
      fetch(`${geocodingApiUrl}/cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sanitized, results: suggestions })
      }).catch(() => console.warn('Backend cache update failed (non-fatal)')),
      // localStorage (legacy support)
      cache.set(cacheKey, suggestions, 24 * 60 * 60 * 1000)
    ])

    return suggestions
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Geocoding request timed out')
      } else {
        console.error('Geocoding error:', error.message)
      }
    } else {
      console.error('Unknown geocoding error', { error: error instanceof Error ? error.message : String(error) })
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
    // Bay Area Airports
    { display_name: 'San Francisco International Airport (SFO)', address: 'SFO Airport', lat: 37.6213, lng: -122.3790, type: 'airport' },
    { display_name: 'San Jose International Airport (SJC)', address: 'SJC Airport', lat: 37.3639, lng: -121.9289, type: 'airport' },
    { display_name: 'Oakland International Airport (OAK)', address: 'OAK Airport', lat: 37.7213, lng: -122.2208, type: 'airport' },

    // Major US Airports
    { display_name: 'Los Angeles International Airport (LAX)', address: 'LAX Airport', lat: 33.9416, lng: -118.4085, type: 'airport' },
    { display_name: 'John F. Kennedy International Airport (JFK)', address: 'JFK Airport', lat: 40.6413, lng: -73.7781, type: 'airport' },
    { display_name: 'O\'Hare International Airport (ORD)', address: 'ORD Airport', lat: 41.9742, lng: -87.9073, type: 'airport' },
    { display_name: 'Dallas/Fort Worth International Airport (DFW)', address: 'DFW Airport', lat: 32.8998, lng: -97.0403, type: 'airport' },
    { display_name: 'Denver International Airport (DEN)', address: 'DEN Airport', lat: 39.8561, lng: -104.6737, type: 'airport' },
    { display_name: 'Hartsfield-Jackson Atlanta Airport (ATL)', address: 'ATL Airport', lat: 33.6407, lng: -84.4277, type: 'airport' },
    { display_name: 'Seattle-Tacoma International Airport (SEA)', address: 'SEA Airport', lat: 47.4502, lng: -122.3088, type: 'airport' },

    // Bay Area Cities
    { display_name: 'Downtown San Francisco', address: 'Downtown SF', lat: 37.7875, lng: -122.4081, type: 'city' },
    { display_name: 'Downtown Oakland', address: 'Downtown Oakland', lat: 37.8044, lng: -122.2712, type: 'city' },
    { display_name: 'Downtown San Jose', address: 'Downtown SJ', lat: 37.3382, lng: -121.8863, type: 'city' },
    { display_name: 'Berkeley, CA', address: 'Berkeley', lat: 37.8715, lng: -122.2730, type: 'city' },
    { display_name: 'Palo Alto, CA', address: 'Palo Alto', lat: 37.4419, lng: -122.1430, type: 'city' },

    // Major US Cities
    { display_name: 'New York, NY', address: 'New York', lat: 40.7128, lng: -74.0060, type: 'city' },
    { display_name: 'Los Angeles, CA', address: 'Los Angeles', lat: 34.0522, lng: -118.2437, type: 'city' },
    { display_name: 'Chicago, IL', address: 'Chicago', lat: 41.8781, lng: -87.6298, type: 'city' },
    { display_name: 'Houston, TX', address: 'Houston', lat: 29.7604, lng: -95.3698, type: 'city' },
    { display_name: 'Phoenix, AZ', address: 'Phoenix', lat: 33.4484, lng: -112.0740, type: 'city' },
    { display_name: 'Philadelphia, PA', address: 'Philadelphia', lat: 39.9526, lng: -75.1652, type: 'city' },
    { display_name: 'San Antonio, TX', address: 'San Antonio', lat: 29.4241, lng: -98.4936, type: 'city' },
    { display_name: 'San Diego, CA', address: 'San Diego', lat: 32.7157, lng: -117.1611, type: 'city' },
    { display_name: 'Dallas, TX', address: 'Dallas', lat: 32.7767, lng: -96.7970, type: 'city' },
    { display_name: 'Austin, TX', address: 'Austin', lat: 30.2672, lng: -97.7431, type: 'city' },
    { display_name: 'Seattle, WA', address: 'Seattle', lat: 47.6062, lng: -122.3321, type: 'city' },
    { display_name: 'Denver, CO', address: 'Denver', lat: 39.7392, lng: -104.9903, type: 'city' },
    { display_name: 'Boston, MA', address: 'Boston', lat: 42.3601, lng: -71.0589, type: 'city' },
    { display_name: 'Portland, OR', address: 'Portland', lat: 45.5152, lng: -122.6784, type: 'city' },
    { display_name: 'Las Vegas, NV', address: 'Las Vegas', lat: 36.1699, lng: -115.1398, type: 'city' },
    { display_name: 'Miami, FL', address: 'Miami', lat: 25.7617, lng: -80.1918, type: 'city' },
    { display_name: 'Atlanta, GA', address: 'Atlanta', lat: 33.7490, lng: -84.3880, type: 'city' },
  ]

  if (!query) return common.slice(0, 10) // Return more by default

  return common.filter(loc =>
    loc.display_name.toLowerCase().includes(query.toLowerCase()) ||
    loc.address.toLowerCase().includes(query.toLowerCase())
  )
}
