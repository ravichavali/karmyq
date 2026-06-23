/**
 * Geocoding Service Tests
 */

import { searchAddresses, getCommonLocations } from '../../src/lib/geocoding'

// Mock fetch
global.fetch = jest.fn()

// Mock AbortSignal.timeout for Node.js compatibility
if (!AbortSignal.timeout) {
  (AbortSignal as any).timeout = (ms: number) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), ms)
    return controller.signal
  }
}

// Mock geocodingCache module to avoid IndexedDB
jest.mock('../../src/lib/geocodingCache', () => ({
  searchCommonLocations: jest.fn(async () => []),
  getCachedResult: jest.fn(async () => null),
  cacheAPIResult: jest.fn(async () => {}),
  initGeocodingCache: jest.fn(async () => {})
}))

describe('Geocoding Service', () => {
  beforeEach(async () => {
    // Reset only fetch; geocodingCache mocks retain their implementations
    ;(fetch as jest.Mock).mockReset()
    // Re-apply geocodingCache defaults after reset
    const geocodingCache = await import('../../src/lib/geocodingCache')
    ;(geocodingCache.searchCommonLocations as jest.Mock).mockResolvedValue([])
    ;(geocodingCache.getCachedResult as jest.Mock).mockResolvedValue(null)
    ;(geocodingCache.cacheAPIResult as jest.Mock).mockResolvedValue(undefined)
  })

  describe('searchAddresses', () => {
    it('should return empty array for queries less than 2 characters', async () => {
      const result = await searchAddresses('S')
      expect(result).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should sanitize and validate input', async () => {
      const result = await searchAddresses('San<script>alert(1)</script>Francisco')
      expect(result).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    })

    it('tries the backend geocoding cache before direct Nominatim fallback', async () => {
      const geocodingCache = await import('../../src/lib/geocodingCache')
      ;(geocodingCache.searchCommonLocations as jest.Mock).mockResolvedValue([])
      ;(geocodingCache.getCachedResult as jest.Mock).mockResolvedValue(null)
      ;(geocodingCache.cacheAPIResult as jest.Mock).mockResolvedValue(undefined)

      const fetchMock = global.fetch as jest.Mock
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            results: [{
              display_name: 'Oakland, CA',
              address: 'Oakland',
              lat: 37.8044,
              lng: -122.2712,
              type: 'city',
            }],
            cached: true,
          },
        }),
      })

      const results = await searchAddresses('Oakland')

      expect(fetchMock.mock.calls[0][0]).toContain('/search?q=Oakland')
      expect(fetchMock.mock.calls[0][0]).not.toContain('nominatim.openstreetmap.org')
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(results[0].address).toBe('Oakland')
    })

    it('does not call public Nominatim when the backend geocoding cache times out', async () => {
      const geocodingCache = await import('../../src/lib/geocodingCache')
      ;(geocodingCache.searchCommonLocations as jest.Mock).mockResolvedValue([])
      ;(geocodingCache.getCachedResult as jest.Mock).mockResolvedValue(null)
      ;(geocodingCache.cacheAPIResult as jest.Mock).mockResolvedValue(undefined)

      const timeoutError = new DOMException('The operation timed out', 'TimeoutError')
      const fetchMock = global.fetch as jest.Mock
      fetchMock.mockRejectedValueOnce(timeoutError)

      const results = await searchAddresses('Oakland')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toContain('/search?q=Oakland')
      expect(results).toEqual([])
    })

    it('should return geocoded results', async () => {
      const mockResponse = [
        {
          display_name: 'San Francisco, California, USA',
          lat: '37.7749',
          lon: '-122.4194',
          type: 'city'
        }
      ]

      ;(fetch as jest.Mock).mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('nominatim')) {
          return Promise.resolve({ ok: true, json: async () => mockResponse })
        }
        return Promise.reject(new Error('Backend unavailable'))
      })

      const result = await searchAddresses('San Francisco')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        address: 'San Francisco, California, USA',
        lat: 37.7749,
        lng: -122.4194,
        type: 'city'
      })
    })

    it('should cache results for 24 hours', async () => {
      const mockResponse = [
        {
          display_name: 'Oakland, California, USA',
          lat: '37.8044',
          lon: '-122.2712',
          type: 'city'
        }
      ]

      // Route by URL: backend calls fail, Nominatim succeeds
      ;(fetch as jest.Mock).mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('nominatim')) {
          return Promise.resolve({ ok: true, json: async () => mockResponse })
        }
        return Promise.reject(new Error('Backend unavailable'))
      })

      // First call - should hit Nominatim (backend unavailable)
      const first = await searchAddresses('Oakland')
      expect(first).toHaveLength(1)

      const nominatimCallsAfterFirst = (fetch as jest.Mock).mock.calls.filter(
        ([url]) => typeof url === 'string' && url.includes('nominatim')
      ).length
      expect(nominatimCallsAfterFirst).toBe(1)

      // Wait for fire-and-forget cache write to complete
      await new Promise(resolve => setTimeout(resolve, 50))

      // Second call - should hit localStorage cache (no new Nominatim calls)
      const second = await searchAddresses('Oakland')
      expect(second).toHaveLength(1)

      const nominatimCallsAfterSecond = (fetch as jest.Mock).mock.calls.filter(
        ([url]) => typeof url === 'string' && url.includes('nominatim')
      ).length
      expect(nominatimCallsAfterSecond).toBe(1) // still 1, cache was used
    })

    it('should handle API errors gracefully', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      })

      const result = await searchAddresses('San Jose')
      expect(result).toEqual([])
    })

    it('should timeout after 5 seconds', async () => {
      ;(fetch as jest.Mock).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))

      const result = await searchAddresses('Slow City')
      expect(result).toEqual([])
    })

    it('should respect rate limiting (1 req/sec)', async () => {
      const mockResponse = [
        { display_name: 'Test', lat: '0', lon: '0', type: 'place' }
      ]

      ;(fetch as jest.Mock).mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('nominatim')) {
          return Promise.resolve({ ok: true, json: async () => mockResponse })
        }
        return Promise.reject(new Error('Backend unavailable'))
      })

      const start = Date.now()

      // Make two requests in quick succession
      await searchAddresses('First')
      await searchAddresses('Second')

      const duration = Date.now() - start

      // Should take at least 1 second (rate limit delay)
      expect(duration).toBeGreaterThanOrEqual(1000)
    }, 10000) // 10 second timeout for rate limiting test
  })

  describe('getCommonLocations', () => {
    it('should return top 10 common locations when no query', () => {
      const result = getCommonLocations('')
      expect(result).toHaveLength(10) // Changed from 3 to 10 after seed data expansion
      expect(result[0].type).toBe('airport')
    })

    it('should filter common locations by query', () => {
      const result = getCommonLocations('SFO')
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].display_name).toContain('SFO')
    })

    it('should be case-insensitive', () => {
      const result = getCommonLocations('oakland')
      expect(result.some(loc => loc.display_name.includes('Oakland'))).toBe(true)
    })
  })
})
