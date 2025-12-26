/**
 * Location Picker Component
 * For selecting addresses with GPS coordinates
 *
 * TODO: Integrate with a real geocoding service (Google Maps, Mapbox, etc.)
 * For now, uses simple text input with example coordinates
 */

import React, { useState } from 'react'

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

  const handleAddressChange = (address: string) => {
    setAddressInput(address)

    // For demo purposes, generate approximate SF Bay Area coordinates
    // TODO: Replace with real geocoding API
    if (address.length > 3) {
      const lat = 37.7749 + (Math.random() * 0.2 - 0.1)
      const lng = -122.4194 + (Math.random() * 0.2 - 0.1)

      onChange({
        address,
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6))
      })
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="space-y-2">
        <input
          type="text"
          value={addressInput}
          onChange={(e) => handleAddressChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        {value && value.lat !== 0 && value.lng !== 0 && (
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
        💡 Tip: Enter a street address for better matching
      </p>
    </div>
  )
}
