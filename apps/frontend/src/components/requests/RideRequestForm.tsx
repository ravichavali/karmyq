/**
 * Ride Request Form Component
 * For creating rideshare requests with origin/destination
 */

import React, { useState } from 'react'
import LocationPicker, { Location } from './shared/LocationPicker'
import DateTimePicker from './shared/DateTimePicker'

export interface RideRequestPayload {
  origin: Location
  destination: Location
  seats_needed: number
  departure_time: string
  scheduled_for?: string
  preferences?: {
    women_only?: boolean
    pet_friendly?: boolean
    wheelchair_accessible?: boolean
  }
}

interface RideRequestFormProps {
  initialData?: Partial<RideRequestPayload>
  onChange: (payload: Partial<RideRequestPayload>) => void
}

export default function RideRequestForm({ initialData, onChange }: RideRequestFormProps) {
  const [formData, setFormData] = useState<Partial<RideRequestPayload>>(initialData || {})

  const updateField = (field: keyof RideRequestPayload, value: any) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    onChange(updated)
  }

  const updatePreference = (pref: string, value: boolean) => {
    const updated = {
      ...formData,
      preferences: {
        ...formData.preferences,
        [pref]: value
      }
    }
    setFormData(updated)
    onChange(updated)
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  return (
    <div className="space-y-6">
      {/* Trip Details Header */}
      <div className="bg-primary-light border border-primary-medium rounded-lg p-4">
        <h3 className="font-semibold text-primary-dark mb-1">🚗 Ride Share Request</h3>
        <p className="text-sm text-primary-dark">
          Provide details about your trip so helpers can offer rides
        </p>
      </div>

      {/* Origin */}
      <LocationPicker
        label="Pick-up Location"
        value={formData.origin || null}
        onChange={(location) => updateField('origin', location)}
        placeholder="Where should you be picked up?"
        required
      />

      {/* Destination */}
      <LocationPicker
        label="Destination"
        value={formData.destination || null}
        onChange={(location) => updateField('destination', location)}
        placeholder="Where are you going?"
        required
      />

      {/* Seats Needed */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">
          Number of Seats Needed <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.seats_needed || 1}
          onChange={(e) => updateField('seats_needed', parseInt(e.target.value))}
          required
          className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          {[1, 2, 3, 4, 5, 6].map(num => (
            <option key={num} value={num}>{num} {num === 1 ? 'seat' : 'seats'}</option>
          ))}
        </select>
      </div>

      {/* Departure Time */}
      <DateTimePicker
        label="Departure Time"
        value={formData.departure_time || ''}
        onChange={(datetime) => {
          const updated = { ...formData, departure_time: datetime, scheduled_for: datetime }
          setFormData(updated)
          onChange(updated)
        }}
        minDate={tomorrow.toISOString()}
        required
        helpText="When do you need to depart?"
      />

      {/* Preferences */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-3">
          Preferences (Optional)
        </label>
        <div className="space-y-3">
          <label className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-surface cursor-pointer">
            <input
              type="checkbox"
              checked={formData.preferences?.women_only || false}
              onChange={(e) => updatePreference('women_only', e.target.checked)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
            />
            <div className="flex-1">
              <span className="font-medium text-text">Women-only ride</span>
              <p className="text-sm text-text-subtle">Prefer female driver/passengers only</p>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-surface cursor-pointer">
            <input
              type="checkbox"
              checked={formData.preferences?.pet_friendly || false}
              onChange={(e) => updatePreference('pet_friendly', e.target.checked)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
            />
            <div className="flex-1">
              <span className="font-medium text-text">Pet-friendly</span>
              <p className="text-sm text-text-subtle">Traveling with a pet</p>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-surface cursor-pointer">
            <input
              type="checkbox"
              checked={formData.preferences?.wheelchair_accessible || false}
              onChange={(e) => updatePreference('wheelchair_accessible', e.target.checked)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
            />
            <div className="flex-1">
              <span className="font-medium text-text">Wheelchair accessible</span>
              <p className="text-sm text-text-subtle">Need wheelchair-accessible vehicle</p>
            </div>
          </label>
        </div>
      </div>

      {/* Summary */}
      {formData.origin && formData.destination && formData.departure_time && (
        <div className="bg-success-light border border-success rounded-lg p-4">
          <h4 className="font-semibold text-karmyq-teal-900 mb-2">Trip Summary</h4>
          <div className="space-y-1 text-sm text-green-800">
            <p><strong>From:</strong> {formData.origin.address}</p>
            <p><strong>To:</strong> {formData.destination.address}</p>
            <p><strong>When:</strong> {new Date(formData.departure_time).toLocaleString()}</p>
            <p><strong>Seats:</strong> {formData.seats_needed || 1}</p>
          </div>
        </div>
      )}
    </div>
  )
}
