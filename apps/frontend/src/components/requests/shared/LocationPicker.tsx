/**
 * Location Picker Component
 * Integrated with geocoding service for real address lookup
 */

import React, { useState, useEffect, useRef } from 'react'
import { searchAddresses, type AddressSuggestion } from '@/lib/geocoding'

export interface Location {
  address: string
  lat: number
  lng: number
}

interface LocationPickerProps {
  label: string
  value: Location | null
  onChange: (location: Location) => void
  placeholder?: string
  required?: boolean
}

export default function LocationPicker({
  label,
  value,
  onChange,
  placeholder = 'Enter address...',
  required = false
}: LocationPickerProps) {
  const [addressInput, setAddressInput] = useState(value?.address || '')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Handle address input changes
  const handleAddressChange = async (address: string) => {
    setAddressInput(address)

    // Trigger geocoding search if input is >= 2 characters
    if (address.length >= 2) {
      setLoading(true)
      setShowSuggestions(true)
      try {
        const results = await searchAddresses(address)
        setSuggestions(results)
      } catch (error) {
        console.error('Geocoding error:', error)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  // Handle selecting a suggestion
  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const location: Location = {
      address: suggestion.address,
      lat: suggestion.lat,
      lng: suggestion.lng
    }

    setAddressInput(suggestion.display_name)
    onChange(location)
    setSuggestions([])
    setShowSuggestions(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative space-y-2">
        <input
          ref={inputRef}
          type="text"
          value={addressInput}
          onChange={(e) => handleAddressChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          required={required}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoComplete="off"
        />

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {loading && (
              <div className="px-4 py-3 text-sm text-gray-500">
                Searching addresses...
              </div>
            )}
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.lat}-${suggestion.lng}-${index}`}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <span className="text-lg mt-0.5">
                    {suggestion.type === 'airport' ? '✈️' : '📍'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {suggestion.display_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {suggestion.address}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected Location Display */}
        {value && value.lat !== 0 && value.lng !== 0 && !showSuggestions && (
          <div className="flex items-start space-x-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="flex-1 text-sm">
              <p className="font-medium text-gray-900">{value.address}</p>
              <p className="text-gray-500 text-xs mt-1">
                Coordinates: {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="text-gray-500 text-xs mt-1">
        💡 Tip: Type at least 2 characters to search for addresses
      </p>
    </div>
  )
}
