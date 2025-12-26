/**
 * Geocoding Service Tests
 */

import { searchAddresses, getCommonLocations } from '../geocoding'
import { cache } from '../cache'

// Mock fetch
global.fetch = jest.fn()

describe('Geocoding Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    cache.clear()
  })

  describe('searchAddresses', () => {
    it('should return empty array for queries less than 3 characters', async () => {
      const result = await searchAddresses('SF')
      expect(result).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should sanitize and validate input', async () => {
      const result = await searchAddresses('San<script>alert(1)</script>Francisco')
      expect(result).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
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

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await searchAddresses('San Francisco')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        address: 'San Francisco',
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

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      // First call - should hit API
      await searchAddresses('Oakland')
      expect(fetch).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      const cached = await searchAddresses('Oakland')
      expect(fetch).toHaveBeenCalledTimes(1) // Still 1, not 2
      expect(cached).toHaveLength(1)
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

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const start = Date.now()

      // Make two requests in quick succession
      await searchAddresses('First')
      await searchAddresses('Second')

      const duration = Date.now() - start

      // Should take at least 1 second (rate limit delay)
      expect(duration).toBeGreaterThanOrEqual(1000)
    })
  })

  describe('getCommonLocations', () => {
    it('should return top 3 common locations when no query', () => {
      const result = getCommonLocations('')
      expect(result).toHaveLength(3)
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
