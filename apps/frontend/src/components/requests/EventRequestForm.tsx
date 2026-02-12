/**
 * Event Request Form Component
 * For volunteer events, community gatherings, and activities
 */

import React, { useState } from 'react'
import LocationPicker, { Location } from './shared/LocationPicker'
import DateTimePicker from './shared/DateTimePicker'

export interface EventRequestPayload {
  event_type: string
  event_date: string
  event_duration_hours: number
  location: {
    address: string
    lat: number
    lng: number
    is_virtual: boolean
    virtual_link?: string | null
  }
  participants_needed: number
  roles?: Array<{
    role_name: string
    count: number
    description?: string
  }>
  requirements?: {
    age_minimum?: number
    background_check?: boolean
    experience_required?: boolean
  }
  recurring?: {
    is_recurring: boolean
    frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly'
    end_date?: string
  }
}

interface EventRequestFormProps {
  initialData?: Partial<EventRequestPayload>
  onChange: (payload: Partial<EventRequestPayload>) => void
}

const EVENT_TYPES = [
  { value: 'volunteer', label: 'Volunteer', icon: '🙌' },
  { value: 'community_cleanup', label: 'Cleanup', icon: '🧹' },
  { value: 'fundraiser', label: 'Fundraiser', icon: '💰' },
  { value: 'workshop', label: 'Workshop', icon: '🛠️' },
  { value: 'meetup', label: 'Meetup', icon: '☕' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
  { value: 'cultural', label: 'Cultural', icon: '🎭' },
  { value: 'educational', label: 'Educational', icon: '📚' },
  { value: 'social', label: 'Social', icon: '🎉' },
  { value: 'other', label: 'Other', icon: '📋' },
]

export default function EventRequestForm({ initialData, onChange }: EventRequestFormProps) {
  const [formData, setFormData] = useState<Partial<EventRequestPayload>>(initialData || {
    location: { is_virtual: false, address: '', lat: 0, lng: 0 }
  })

  const updateField = (field: keyof EventRequestPayload, value: any) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    onChange(updated)
  }

  const updateLocation = (field: string, value: any) => {
    const updated = {
      ...formData,
      location: {
        ...formData.location,
        address: formData.location?.address || '',
        lat: formData.location?.lat || 0,
        lng: formData.location?.lng || 0,
        is_virtual: formData.location?.is_virtual || false,
        [field]: value
      }
    }
    setFormData(updated)
    onChange(updated)
  }

  const updateRequirement = (field: string, value: any) => {
    const updated = {
      ...formData,
      requirements: {
        ...formData.requirements,
        [field]: value
      }
    }
    setFormData(updated)
    onChange(updated)
  }

  const updateRecurring = (field: string, value: any) => {
    const updated = {
      ...formData,
      recurring: {
        ...formData.recurring,
        is_recurring: formData.recurring?.is_recurring || false,
        [field]: value
      }
    }
    setFormData(updated)
    onChange(updated)
  }

  const handlePhysicalLocation = (location: Location) => {
    const updated = {
      ...formData,
      location: {
        ...location,
        is_virtual: false,
        virtual_link: null
      }
    }
    setFormData(updated)
    onChange(updated)
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  return (
    <div className="space-y-6">
      {/* Event Header */}
      <div className="bg-accent-light border border-accent rounded-lg p-4">
        <h3 className="font-semibold text-karmyq-orange-900 mb-1">🎉 Event Request</h3>
        <p className="text-sm text-accent-dark">
          Organize volunteer events, community activities, or gatherings
        </p>
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-3">
          Event Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {EVENT_TYPES.map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => updateField('event_type', type.value)}
              className={`
                p-3 border-2 rounded-lg text-center transition-all
                ${formData.event_type === type.value
                  ? 'border-karmyq-orange-500 bg-accent-light ring-2 ring-accent'
                  : 'border-border hover:border-karmyq-orange-400'
                }
              `}
            >
              <div className="text-2xl mb-1">{type.icon}</div>
              <div className="text-xs font-medium text-text">{type.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Event Date and Duration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateTimePicker
          label="Event Date & Time"
          value={formData.event_date || ''}
          onChange={(datetime) => updateField('event_date', datetime)}
          minDate={tomorrow.toISOString()}
          required
          helpText="When will this event take place?"
        />

        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Duration <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={formData.event_duration_hours || ''}
              onChange={(e) => updateField('event_duration_hours', e.target.value ? parseFloat(e.target.value) : undefined)}
              required
              className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <span className="text-sm text-text-muted whitespace-nowrap">hours</span>
          </div>
        </div>
      </div>

      {/* Virtual/Physical Toggle */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">
          Event Location <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={() => updateLocation('is_virtual', false)}
            className={`
              flex-1 p-3 border-2 rounded-lg transition-all
              ${!formData.location?.is_virtual
                ? 'border-karmyq-orange-500 bg-accent-light'
                : 'border-border hover:border-karmyq-orange-400'
              }
            `}
          >
            <div className="text-xl mb-1">📍</div>
            <div className="text-sm font-medium">Physical Location</div>
          </button>
          <button
            type="button"
            onClick={() => updateLocation('is_virtual', true)}
            className={`
              flex-1 p-3 border-2 rounded-lg transition-all
              ${formData.location?.is_virtual
                ? 'border-karmyq-orange-500 bg-accent-light'
                : 'border-border hover:border-karmyq-orange-400'
              }
            `}
          >
            <div className="text-xl mb-1">💻</div>
            <div className="text-sm font-medium">Virtual Event</div>
          </button>
        </div>

        {/* Physical Location */}
        {!formData.location?.is_virtual && (
          <LocationPicker
            label="Event Address"
            value={formData.location ? {
              address: formData.location.address,
              lat: formData.location.lat,
              lng: formData.location.lng
            } : null}
            onChange={handlePhysicalLocation}
            placeholder="Where will this event be held?"
            required
          />
        )}

        {/* Virtual Link */}
        {formData.location?.is_virtual && (
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Virtual Meeting Link (Optional)
            </label>
            <input
              type="url"
              value={formData.location?.virtual_link || ''}
              onChange={(e) => updateLocation('virtual_link', e.target.value || null)}
              placeholder="https://zoom.us/j/..."
              className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <p className="mt-1 text-xs text-text-subtle">You can add this later if not confirmed yet</p>
          </div>
        )}
      </div>

      {/* Participants Needed */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">
          Participants Needed <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min="1"
          max="1000"
          value={formData.participants_needed || ''}
          onChange={(e) => updateField('participants_needed', e.target.value ? parseInt(e.target.value) : undefined)}
          required
          placeholder="How many volunteers do you need?"
          className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-accent focus:border-transparent"
        />
      </div>

      {/* Requirements */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-3">
          Requirements (Optional)
        </label>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-text-muted mb-1">Minimum Age</label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.requirements?.age_minimum || ''}
              onChange={(e) => updateRequirement('age_minimum', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="18"
              className="w-32 border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <label className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-surface cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requirements?.background_check || false}
              onChange={(e) => updateRequirement('background_check', e.target.checked)}
              className="mt-1 h-4 w-4 text-accent focus:ring-accent border-border rounded"
            />
            <div className="flex-1">
              <span className="font-medium text-text">Background check required</span>
              <p className="text-sm text-text-subtle">Volunteers must pass background screening</p>
            </div>
          </label>

          <label className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-surface cursor-pointer">
            <input
              type="checkbox"
              checked={formData.requirements?.experience_required || false}
              onChange={(e) => updateRequirement('experience_required', e.target.checked)}
              className="mt-1 h-4 w-4 text-accent focus:ring-accent border-border rounded"
            />
            <div className="flex-1">
              <span className="font-medium text-text">Experience required</span>
              <p className="text-sm text-text-subtle">Volunteers should have prior experience</p>
            </div>
          </label>
        </div>
      </div>

      {/* Recurring Event */}
      <div>
        <label className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-surface cursor-pointer">
          <input
            type="checkbox"
            checked={formData.recurring?.is_recurring || false}
            onChange={(e) => updateRecurring('is_recurring', e.target.checked)}
            className="mt-1 h-4 w-4 text-accent focus:ring-accent border-border rounded"
          />
          <div className="flex-1">
            <span className="font-medium text-text">This is a recurring event</span>
            <p className="text-sm text-text-subtle">Event repeats on a schedule</p>
          </div>
        </label>

        {formData.recurring?.is_recurring && (
          <div className="mt-3 ml-7 space-y-3">
            <div>
              <label className="block text-sm text-text-muted mb-1">Frequency</label>
              <select
                value={formData.recurring?.frequency || 'weekly'}
                onChange={(e) => updateRecurring('frequency', e.target.value)}
                className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1">End Date (Optional)</label>
              <DateTimePicker
                label=""
                value={formData.recurring?.end_date || ''}
                onChange={(datetime) => updateRecurring('end_date', datetime)}
                minDate={formData.event_date || tomorrow.toISOString()}
                helpText="When does this recurring event series end?"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      {formData.event_type && formData.event_date && formData.participants_needed && (
        <div className="bg-accent-light border border-accent rounded-lg p-4">
          <h4 className="font-semibold text-karmyq-orange-900 mb-2">Event Summary</h4>
          <div className="space-y-1 text-sm text-accent-dark">
            <p>
              <strong>Type:</strong> {EVENT_TYPES.find(t => t.value === formData.event_type)?.label}
            </p>
            <p>
              <strong>When:</strong> {new Date(formData.event_date).toLocaleString()}
            </p>
            {formData.event_duration_hours && (
              <p><strong>Duration:</strong> {formData.event_duration_hours} hours</p>
            )}
            <p>
              <strong>Location:</strong> {formData.location?.is_virtual
                ? `Virtual${formData.location.virtual_link ? ` (${formData.location.virtual_link})` : ''}`
                : formData.location?.address || 'TBD'
              }
            </p>
            <p><strong>Participants:</strong> {formData.participants_needed} needed</p>
            {formData.recurring?.is_recurring && (
              <p><strong>Recurring:</strong> {formData.recurring.frequency}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
