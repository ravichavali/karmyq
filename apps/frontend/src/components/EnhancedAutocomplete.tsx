/**
 * Enhanced Autocomplete Component
 * - Async address lookup with geocoding
 * - Tab/Enter to select
 * - Shows real addresses from OpenStreetMap
 * - Date/time picker integration
 */

import React, { useRef, useEffect, useState } from 'react'
import { searchAddresses, getCommonLocations, debounce, AddressSuggestion } from '@/lib/geocoding'

interface Suggestion {
  value: string
  label: string
  description?: string
  icon?: string
  lat?: number
  lng?: number
  category?: 'time' | 'location' | 'count' | 'budget' | 'urgency' | 'navigation'
}

interface EnhancedAutocompleteProps {
  suggestions: Suggestion[]
  onSelect: (value: string, lat?: number, lng?: number, displayName?: string, category?: string) => void
  onClose: () => void
  triggerChar: '@' | '#' | '$' | '!' | '..' | '>>' | null
  position?: { top: number; left: number }
  searchQuery?: string // Current text after trigger
}

export default function EnhancedAutocomplete({
  suggestions: initialSuggestions,
  onSelect,
  onClose,
  triggerChar,
  position,
  searchQuery = ''
}: EnhancedAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions)
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to selected item
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex + 1] as HTMLElement // +1 for header
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0)
    setSuggestions(initialSuggestions)
  }, [initialSuggestions])

  // Async address lookup when user types after @ or in location context (from/to)
  useEffect(() => {
    console.log('🔧 EnhancedAutocomplete useEffect:', { triggerChar, searchQuery, length: searchQuery.length })

    if (triggerChar === '@' && searchQuery.length >= 2) {
      console.log('✅ Triggering geocoding search for:', searchQuery)

      const performSearch = async () => {
        setLoading(true)
        try {
          console.log('🌐 Calling searchAddresses API...')
          // Get real addresses from geocoding API
          const addresses = await searchAddresses(searchQuery)
          console.log('📦 Geocoding results:', addresses.length, 'addresses found')
          const addressSuggestions: Suggestion[] = addresses.map(addr => ({
            value: `@${addr.address}`,
            label: addr.display_name, // Show full address in autocomplete
            description: addr.address, // Show short name in description
            icon: addr.type === 'airport' ? '✈️' : '📍',
            lat: addr.lat,
            lng: addr.lng,
            category: 'location' as const
          }))

          // Combine with common locations and time suggestions
          const commonLocations = getCommonLocations(searchQuery).map(loc => ({
            value: `@${loc.address}`,
            label: loc.display_name, // Show full name in autocomplete
            description: loc.address, // Show short name in description
            icon: loc.type === 'airport' ? '✈️' : '🏙️',
            lat: loc.lat,
            lng: loc.lng,
            category: 'location' as const
          }))

          // Filter initial time suggestions
          const timeSuggestions = initialSuggestions.filter(s => s.category === 'time')

          setSuggestions([...commonLocations, ...addressSuggestions, ...timeSuggestions])
        } catch (error) {
          console.error('Address search error:', error)
        } finally {
          setLoading(false)
        }
      }

      // Debounce the search to avoid too many API calls
      const timeoutId = setTimeout(performSearch, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [searchQuery, triggerChar])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!suggestions.length) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % suggestions.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          const selected = suggestions[selectedIndex]
          onSelect(selected.value, selected.lat, selected.lng, selected.description, selected.category)
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [suggestions, selectedIndex, onSelect, onClose])

  if (!suggestions.length && !loading) return null

  const getTriggerColor = () => {
    switch (triggerChar) {
      case '@': return 'bg-blue-50 border-blue-200'
      case '#': return 'bg-green-50 border-green-200'
      case '$': return 'bg-yellow-50 border-yellow-200'
      case '!': return 'bg-red-50 border-red-200'
      case '..':
      case '>>': return 'bg-purple-50 border-purple-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  const getTriggerLabel = () => {
    switch (triggerChar) {
      case '@': return 'Locations & Times'
      case '#': return 'Counts'
      case '$': return 'Budget'
      case '!': return 'Urgency'
      case '..': return 'From (Origin)'
      case '>>': return 'To (Destination)'
      default: return 'Suggestions'
    }
  }

  return (
    <div
      ref={listRef}
      className={`absolute z-50 mt-1 w-96 rounded-lg shadow-xl border-2 ${getTriggerColor()} overflow-hidden`}
      style={position}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">
            {getTriggerLabel()}
          </span>
          <span className="text-xs text-gray-500">
            ↑↓ navigate · ↵/Tab select · Esc close
          </span>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="max-h-80 overflow-y-auto bg-white">
        {loading && (
          <div className="px-3 py-4 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Searching addresses...
          </div>
        )}

        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.value}-${index}`}
            type="button"
            onClick={() => onSelect(suggestion.value, suggestion.lat, suggestion.lng, suggestion.description, suggestion.category)}
            className={`w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors ${
              index === selectedIndex
                ? 'bg-blue-100 text-blue-900 border-l-4 border-blue-600'
                : 'hover:bg-gray-50 text-gray-900 border-l-4 border-transparent'
            }`}
          >
            {suggestion.icon && (
              <span className="text-xl flex-shrink-0 mt-0.5">{suggestion.icon}</span>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm flex items-center gap-2">
                {suggestion.label}
                {suggestion.lat && suggestion.lng && (
                  <span className="text-xs text-gray-500 font-normal">
                    📍 {suggestion.lat.toFixed(4)}, {suggestion.lng.toFixed(4)}
                  </span>
                )}
              </div>
              {suggestion.description && (
                <div className="text-xs text-gray-600 mt-0.5 truncate">
                  {suggestion.description}
                </div>
              )}
            </div>
            {index === selectedIndex && (
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Footer Hint */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          {triggerChar === '@' && searchQuery.length < 3 ? (
            <span>💡 Type 3+ characters to search real addresses</span>
          ) : (
            <span>💡 Tab or Enter to select, keep typing to filter</span>
          )}
        </p>
      </div>
    </div>
  )
}
