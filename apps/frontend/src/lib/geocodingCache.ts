/**
 * Local Geocoding Cache using IndexedDB (Native API)
 *
 * Features:
 * - Local-first geocoding (check IndexedDB before API)
 * - Auto-cache API results for future use
 * - Pre-seeded with common locations (airports, major cities)
 * - User address book for favorite locations
 *
 * No external dependencies - uses native IndexedDB API
 */

export interface CommonLocation {
  search_key: string
  display_name: string
  address: string
  lat: number
  lng: number
  type: string
  state?: string
  rank: number
}

export interface CachedResult {
  query: string
  results: Array<{
    display_name: string
    address: string
    lat: number
    lng: number
    type: string
  }>
  cached_at: number
  expires_at: number
}

export interface AddressBookEntry {
  id?: number
  user_id: string
  label: string
  display_name: string
  address: string
  lat: number
  lng: number
  type: 'home' | 'work' | 'favorite'
  created_at: number
  last_used: number
  use_count: number
}

const DB_NAME = 'karmyq-geocoding'
const DB_VERSION = 1

let dbInstance: IDBDatabase | null = null

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Common locations store
      if (!db.objectStoreNames.contains('common_locations')) {
        const commonStore = db.createObjectStore('common_locations', { keyPath: 'search_key' })
        commonStore.createIndex('by_type', 'type', { unique: false })
        commonStore.createIndex('by_rank', 'rank', { unique: false })
      }

      // API cache store
      if (!db.objectStoreNames.contains('api_cache')) {
        db.createObjectStore('api_cache', { keyPath: 'query' })
      }

      // User address book store
      if (!db.objectStoreNames.contains('address_book')) {
        const addressBookStore = db.createObjectStore('address_book', {
          keyPath: 'id',
          autoIncrement: true
        })
        addressBookStore.createIndex('by_user', 'user_id', { unique: false })
        addressBookStore.createIndex('by_last_used', 'last_used', { unique: false })
        addressBookStore.createIndex('by_use_count', 'use_count', { unique: false })
      }
    }
  })
}

/**
 * Normalize search query for consistent matching
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Search common locations (airports, cities)
 */
export async function searchCommonLocations(query: string, limit = 5): Promise<Array<{
  display_name: string
  address: string
  lat: number
  lng: number
  type: string
}>> {
  const db = await openDB()
  const normalized = normalizeQuery(query)

  return new Promise((resolve, reject) => {
    const tx = db.transaction('common_locations', 'readonly')
    const store = tx.objectStore('common_locations')
    const request = store.getAll()

    request.onsuccess = () => {
      const allLocations = request.result as CommonLocation[]

      const matches = allLocations
        .filter(loc =>
          loc.search_key.includes(normalized) ||
          loc.address.toLowerCase().includes(normalized) ||
          loc.display_name.toLowerCase().includes(normalized)
        )
        .sort((a, b) => b.rank - a.rank)
        .slice(0, limit)
        .map(loc => ({
          display_name: loc.display_name,
          address: loc.address,
          lat: loc.lat,
          lng: loc.lng,
          type: loc.type
        }))

      resolve(matches)
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Get cached API result
 */
export async function getCachedResult(query: string) {
  const db = await openDB()
  const normalized = normalizeQuery(query)

  return new Promise<Array<{
    display_name: string
    address: string
    lat: number
    lng: number
    type: string
  }> | null>((resolve, reject) => {
    const tx = db.transaction('api_cache', 'readonly')
    const store = tx.objectStore('api_cache')
    const request = store.get(normalized)

    request.onsuccess = () => {
      const cached = request.result as CachedResult | undefined

      if (!cached) {
        resolve(null)
        return
      }

      // Check if expired (24 hours TTL)
      if (Date.now() > cached.expires_at) {
        // Delete expired cache entry
        const deleteTx = db.transaction('api_cache', 'readwrite')
        deleteTx.objectStore('api_cache').delete(normalized)
        resolve(null)
        return
      }

      resolve(cached.results)
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Cache API result
 */
export async function cacheAPIResult(
  query: string,
  results: Array<{ display_name: string; address: string; lat: number; lng: number; type: string }>
): Promise<void> {
  const db = await openDB()
  const normalized = normalizeQuery(query)

  return new Promise((resolve, reject) => {
    const tx = db.transaction('api_cache', 'readwrite')
    const store = tx.objectStore('api_cache')

    const cacheEntry: CachedResult = {
      query: normalized,
      results,
      cached_at: Date.now(),
      expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    }

    const request = store.put(cacheEntry)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get user's address book
 */
export async function getUserAddressBook(userId: string): Promise<AddressBookEntry[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction('address_book', 'readonly')
    const store = tx.objectStore('address_book')
    const index = store.index('by_user')
    const request = index.getAll(userId)

    request.onsuccess = () => {
      const addresses = request.result as AddressBookEntry[]
      const sorted = addresses.sort((a, b) => b.use_count - a.use_count)
      resolve(sorted)
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Add address to user's address book
 */
export async function addToAddressBook(
  userId: string,
  label: string,
  displayName: string,
  address: string,
  lat: number,
  lng: number,
  type: 'home' | 'work' | 'favorite' = 'favorite'
): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction('address_book', 'readwrite')
    const store = tx.objectStore('address_book')

    const entry: AddressBookEntry = {
      user_id: userId,
      label,
      display_name: displayName,
      address,
      lat,
      lng,
      type,
      created_at: Date.now(),
      last_used: Date.now(),
      use_count: 1
    }

    const request = store.add(entry)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Seed common locations (airports and major cities)
 */
export async function seedCommonLocations(): Promise<void> {
  const db = await openDB()

  return new Promise(async (resolve, reject) => {
    const tx = db.transaction('common_locations', 'readwrite')
    const store = tx.objectStore('common_locations')

    // Check if already seeded
    const countRequest = store.count()
    countRequest.onsuccess = () => {
      if (countRequest.result > 0) {
        resolve() // Already seeded
        return
      }

      const commonLocations: CommonLocation[] = [
        // Major US Airports (rank 100)
        { search_key: 'sfo', display_name: 'San Francisco International Airport (SFO), San Mateo County, California, USA', address: 'SFO Airport', lat: 37.6213, lng: -122.379, type: 'airport', state: 'CA', rank: 100 },
        { search_key: 'jfk', display_name: 'John F. Kennedy International Airport (JFK), Queens, New York, USA', address: 'JFK Airport', lat: 40.6413, lng: -73.7781, type: 'airport', state: 'NY', rank: 100 },
        { search_key: 'lax', display_name: 'Los Angeles International Airport (LAX), Los Angeles, California, USA', address: 'LAX Airport', lat: 33.9416, lng: -118.4085, type: 'airport', state: 'CA', rank: 100 },
        { search_key: 'ord', display_name: "O'Hare International Airport (ORD), Chicago, Illinois, USA", address: 'ORD Airport', lat: 41.9742, lng: -87.9073, type: 'airport', state: 'IL', rank: 100 },
        { search_key: 'atl', display_name: 'Hartsfield-Jackson Atlanta International Airport (ATL), Atlanta, Georgia, USA', address: 'ATL Airport', lat: 33.6407, lng: -84.4277, type: 'airport', state: 'GA', rank: 100 },
        { search_key: 'oak', display_name: 'Oakland International Airport (OAK), Oakland, California, USA', address: 'OAK Airport', lat: 37.7126, lng: -122.2197, type: 'airport', state: 'CA', rank: 90 },
        { search_key: 'sjc', display_name: 'San Jose International Airport (SJC), San Jose, California, USA', address: 'SJC Airport', lat: 37.3639, lng: -121.9289, type: 'airport', state: 'CA', rank: 90 },

        // Major US Cities (rank 80-90)
        { search_key: 'san francisco', display_name: 'San Francisco, California, USA', address: 'San Francisco', lat: 37.7749, lng: -122.4194, type: 'city', state: 'CA', rank: 90 },
        { search_key: 'new york', display_name: 'New York, New York, USA', address: 'New York', lat: 40.7128, lng: -74.0060, type: 'city', state: 'NY', rank: 90 },
        { search_key: 'los angeles', display_name: 'Los Angeles, California, USA', address: 'Los Angeles', lat: 34.0522, lng: -118.2437, type: 'city', state: 'CA', rank: 90 },
        { search_key: 'chicago', display_name: 'Chicago, Illinois, USA', address: 'Chicago', lat: 41.8781, lng: -87.6298, type: 'city', state: 'IL', rank: 90 },
        { search_key: 'oakland', display_name: 'Oakland, California, USA', address: 'Oakland', lat: 37.8044, lng: -122.2712, type: 'city', state: 'CA', rank: 85 },
        { search_key: 'san jose', display_name: 'San Jose, California, USA', address: 'San Jose', lat: 37.3382, lng: -121.8863, type: 'city', state: 'CA', rank: 85 },
      ]

      // Add all locations
      const addPromises = commonLocations.map(loc => {
        return new Promise<void>((addResolve, addReject) => {
          const addRequest = store.add(loc)
          addRequest.onsuccess = () => addResolve()
          addRequest.onerror = () => addReject(addRequest.error)
        })
      })

      Promise.all(addPromises)
        .then(() => {
          console.log(`✅ Seeded ${commonLocations.length} common locations to IndexedDB`)
          resolve()
        })
        .catch(reject)
    }

    countRequest.onerror = () => reject(countRequest.error)
  })
}

/**
 * Initialize geocoding cache (call on app startup)
 */
export async function initGeocodingCache(): Promise<void> {
  try {
    await openDB()
    await seedCommonLocations()
    console.log('✅ Geocoding cache initialized')
  } catch (error) {
    console.error('Failed to initialize geocoding cache', { error: error instanceof Error ? error.message : String(error) })
  }
}
