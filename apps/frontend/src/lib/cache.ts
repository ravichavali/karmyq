/**
 * Client-Side Caching Service
 * Uses IndexedDB for persistent caching with TTL
 * Fallback to localStorage if IndexedDB unavailable
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

const DB_NAME = 'karmyq-cache'
const DB_VERSION = 1
const STORE_NAME = 'geocoding'

class CacheService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve() // SSR - skip initialization
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.warn('IndexedDB unavailable, using localStorage fallback')
        resolve()
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
    })

    return this.initPromise
  }

  /**
   * Get cached data if valid
   */
  async get<T>(key: string): Promise<T | null> {
    await this.init()

    // Try IndexedDB first
    if (this.db) {
      try {
        const entry = await this.getFromIndexedDB<T>(key)
        if (entry && this.isValid(entry)) {
          return entry.data
        }
      } catch (error) {
        console.error('IndexedDB get error:', error)
      }
    }

    // Fallback to localStorage
    try {
      const item = localStorage.getItem(`cache:${key}`)
      if (item) {
        const entry: CacheEntry<T> = JSON.parse(item)
        if (this.isValid(entry)) {
          return entry.data
        } else {
          localStorage.removeItem(`cache:${key}`)
        }
      }
    } catch (error) {
      console.error('localStorage get error:', error)
    }

    return null
  }

  /**
   * Set cached data with TTL
   */
  async set<T>(key: string, data: T, ttl: number = 24 * 60 * 60 * 1000): Promise<void> {
    await this.init()

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    }

    // Try IndexedDB first
    if (this.db) {
      try {
        await this.setInIndexedDB(key, entry)
        return
      } catch (error) {
        console.error('IndexedDB set error:', error)
      }
    }

    // Fallback to localStorage
    try {
      localStorage.setItem(`cache:${key}`, JSON.stringify(entry))
    } catch (error) {
      console.error('localStorage set error:', error)
      // Quota exceeded - clear old entries
      this.clearExpired()
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl
  }

  /**
   * Get from IndexedDB
   */
  private getFromIndexedDB<T>(key: string): Promise<CacheEntry<T> | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve(null)
        return
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Set in IndexedDB
   */
  private setInIndexedDB<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'))
        return
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(entry, key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear expired entries
   */
  async clearExpired(): Promise<void> {
    await this.init()

    // Clear from IndexedDB
    if (this.db) {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.openCursor()

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor) {
            const entry = cursor.value as CacheEntry<any>
            if (!this.isValid(entry)) {
              cursor.delete()
            }
            cursor.continue()
          }
        }
      } catch (error) {
        console.error('IndexedDB clear error:', error)
      }
    }

    // Clear from localStorage
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('cache:')) {
          try {
            const item = localStorage.getItem(key)
            if (item) {
              const entry = JSON.parse(item)
              if (!this.isValid(entry)) {
                keysToRemove.push(key)
              }
            }
          } catch (e) {
            keysToRemove.push(key)
          }
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('localStorage clear error:', error)
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    await this.init()

    // Clear IndexedDB
    if (this.db) {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        store.clear()
      } catch (error) {
        console.error('IndexedDB clear error:', error)
      }
    }

    // Clear localStorage
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('cache:')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('localStorage clear error:', error)
    }
  }
}

// Export singleton instance
export const cache = new CacheService()

/**
 * Create a cache key from parameters
 */
export function createCacheKey(prefix: string, ...params: any[]): string {
  return `${prefix}:${params.map(p => String(p)).join(':')}`
}
