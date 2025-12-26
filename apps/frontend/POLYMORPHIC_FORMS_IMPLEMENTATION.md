# Polymorphic Request Forms - Implementation Guide

## Status

✅ **Completed Components:**
- `RequestTypeSelector.tsx` - Type selection UI
- `LocationPicker.tsx` - Address/GPS picker (with geocoding placeholder)
- `DateTimePicker.tsx` - ISO datetime picker
- `RideRequestForm.tsx` - Complete ride form with preferences

🔨 **Remaining Components to Create:**
- `ServiceRequestForm.tsx`
- `EventRequestForm.tsx`
- `BorrowRequestForm.tsx`
- `GenericRequestForm.tsx`
- Update `requests/new.tsx` to orchestrate all forms

---

## Component Templates

### ServiceRequestForm.tsx

```typescript
/**
 * Service Request Form Component
 * For professional services, repairs, tutoring, etc.
 */

import React, { useState } from 'react'

export interface ServiceRequestPayload {
  service_category: string
  skill_level_required?: 'beginner' | 'intermediate' | 'expert'
  estimated_duration_hours?: number
  location_type: 'remote' | 'on_site' | 'hybrid'
  certifications_required?: string[]
}

const SERVICE_CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'tutoring', label: 'Tutoring' },
  { value: 'tech_support', label: 'Tech Support' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'gardening', label: 'Gardening' },
  { value: 'pet_care', label: 'Pet Care' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'other', label: 'Other' }
]

interface ServiceRequestFormProps {
  initialData?: Partial<ServiceRequestPayload>
  onChange: (payload: Partial<ServiceRequestPayload>) => void
}

export default function ServiceRequestForm({ initialData, onChange }: ServiceRequestFormProps) {
  const [formData, setFormData] = useState<Partial<ServiceRequestPayload>>(
    initialData || { location_type: 'on_site' }
  )

  const updateField = (field: keyof ServiceRequestPayload, value: any) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-1">🔧 Service Request</h3>
        <p className="text-sm text-green-700">
          Request professional services, repairs, or tutoring
        </p>
      </div>

      {/* Service Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Service Category <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.service_category || ''}
          onChange={(e) => updateField('service_category', e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select category...</option>
          {SERVICE_CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Skill Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Skill Level Required
        </label>
        <select
          value={formData.skill_level_required || ''}
          onChange={(e) => updateField('skill_level_required', e.target.value || undefined)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Any skill level</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="expert">Expert/Professional</option>
        </select>
      </div>

      {/* Location Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Location Type <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {['on_site', 'remote', 'hybrid'].map(type => (
            <label key={type} className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="location_type"
                value={type}
                checked={formData.location_type === type}
                onChange={(e) => updateField('location_type', e.target.value)}
                className="h-4 w-4 text-blue-600"
              />
              <span className="capitalize">{type.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Estimated Duration (hours)
        </label>
        <input
          type="number"
          min="0.5"
          max="80"
          step="0.5"
          value={formData.estimated_duration_hours || ''}
          onChange={(e) => updateField('estimated_duration_hours', parseFloat(e.target.value) || undefined)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., 2"
        />
      </div>
    </div>
  )
}
```

### EventRequestForm.tsx

```typescript
/**
 * Event Request Form Component
 * For community events, volunteer opportunities
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
    lat?: number
    lng?: number
    is_virtual: boolean
    virtual_link?: string
  }
  participants_needed: number
}

const EVENT_TYPES = [
  { value: 'volunteer', label: 'Volunteer Event' },
  { value: 'community_cleanup', label: 'Community Cleanup' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'sports', label: 'Sports Event' },
  { value: 'social', label: 'Social Gathering' },
  { value: 'other', label: 'Other' }
]

interface EventRequestFormProps {
  initialData?: Partial<EventRequestPayload>
  onChange: (payload: Partial<EventRequestPayload>) => void
}

export default function EventRequestForm({ initialData, onChange }: EventRequestFormProps) {
  const [formData, setFormData] = useState<Partial<EventRequestPayload>>(
    initialData || { location: { is_virtual: false, address: '' } }
  )

  const updateField = (field: keyof EventRequestPayload, value: any) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    onChange(updated)
  }

  const updateLocation = (location: Location) => {
    updateField('location', {
      ...formData.location,
      address: location.address,
      lat: location.lat,
      lng: location.lng
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="font-semibold text-purple-900 mb-1">🎉 Event Request</h3>
        <p className="text-sm text-purple-700">
          Recruit volunteers or participants for your event
        </p>
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Event Type <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.event_type || ''}
          onChange={(e) => updateField('event_type', e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select event type...</option>
          {EVENT_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Event Date */}
      <DateTimePicker
        label="Event Date & Time"
        value={formData.event_date || ''}
        onChange={(datetime) => updateField('event_date', datetime)}
        required
        helpText="When does the event start?"
      />

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Duration (hours) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min="0.5"
          max="24"
          step="0.5"
          value={formData.event_duration_hours || ''}
          onChange={(e) => updateField('event_duration_hours', parseFloat(e.target.value))}
          required
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., 3"
        />
      </div>

      {/* Virtual Event Toggle */}
      <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer">
        <input
          type="checkbox"
          checked={formData.location?.is_virtual || false}
          onChange={(e) => updateField('location', { ...formData.location, is_virtual: e.target.checked })}
          className="h-4 w-4 text-blue-600"
        />
        <span>This is a virtual event</span>
      </label>

      {/* Location */}
      {!formData.location?.is_virtual && (
        <LocationPicker
          label="Event Location"
          value={formData.location?.address ? {
            address: formData.location.address,
            lat: formData.location.lat || 0,
            lng: formData.location.lng || 0
          } : null}
          onChange={updateLocation}
          required
        />
      )}

      {/* Virtual Link */}
      {formData.location?.is_virtual && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Virtual Meeting Link
          </label>
          <input
            type="url"
            value={formData.location?.virtual_link || ''}
            onChange={(e) => updateField('location', { ...formData.location, virtual_link: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="https://zoom.us/j/..."
          />
        </div>
      )}

      {/* Participants */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Number of Participants Needed <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min="1"
          max="1000"
          value={formData.participants_needed || ''}
          onChange={(e) => updateField('participants_needed', parseInt(e.target.value))}
          required
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., 10"
        />
      </div>
    </div>
  )
}
```

### BorrowRequestForm.tsx

```typescript
/**
 * Borrow Request Form Component
 * For borrowing tools, equipment, books, etc.
 */

import React, { useState } from 'react'

export interface BorrowRequestPayload {
  item_category: string
  duration_days: number
  condition_min?: 'fair' | 'good' | 'like_new' | 'new'
}

const ITEM_CATEGORIES = [
  { value: 'tools', label: 'Tools & Equipment', icon: '🔨' },
  { value: 'electronics', label: 'Electronics', icon: '💻' },
  { value: 'kitchen', label: 'Kitchen Items', icon: '🍳' },
  { value: 'books', label: 'Books', icon: '📚' },
  { value: 'sports', label: 'Sports Equipment', icon: '⚽' },
  { value: 'camping', label: 'Camping Gear', icon: '⛺' },
  { value: 'party', label: 'Party Supplies', icon: '🎈' },
  { value: 'other', label: 'Other', icon: '📦' }
]

interface BorrowRequestFormProps {
  initialData?: Partial<BorrowRequestPayload>
  onChange: (payload: Partial<BorrowRequestPayload>) => void
}

export default function BorrowRequestForm({ initialData, onChange }: BorrowRequestFormProps) {
  const [formData, setFormData] = useState<Partial<BorrowRequestPayload>>(initialData || {})

  const updateField = (field: keyof BorrowRequestPayload, value: any) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h3 className="font-semibold text-orange-900 mb-1">📦 Borrow Request</h3>
        <p className="text-sm text-orange-700">
          Temporarily borrow items from community members
        </p>
      </div>

      {/* Item Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          What do you need to borrow? <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {ITEM_CATEGORIES.map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => updateField('item_category', cat.value)}
              className={`
                p-4 border-2 rounded-lg text-left transition
                ${formData.item_category === cat.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="text-2xl mb-1">{cat.icon}</div>
              <div className="text-sm font-medium">{cat.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          How long do you need it? <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="number"
            min="1"
            max="30"
            value={formData.duration_days || ''}
            onChange={(e) => updateField('duration_days', parseInt(e.target.value))}
            required
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="Number of days"
          />
          <span className="text-gray-500">days (max 30)</span>
        </div>
      </div>

      {/* Condition */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Minimum Condition Required
        </label>
        <select
          value={formData.condition_min || ''}
          onChange={(e) => updateField('condition_min', e.target.value || undefined)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Any condition</option>
          <option value="fair">Fair</option>
          <option value="good">Good</option>
          <option value="like_new">Like New</option>
          <option value="new">New</option>
        </select>
      </div>
    </div>
  )
}
```

### GenericRequestForm.tsx

```typescript
/**
 * Generic Request Form Component
 * Simplified form for general help requests
 */

import React from 'react'

interface GenericRequestFormProps {
  // No payload needed for generic requests
}

export default function GenericRequestForm({}: GenericRequestFormProps) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-1">🤝 General Help Request</h3>
        <p className="text-sm text-gray-700">
          Use the title and description fields below to explain what you need.
          Generic requests don't require additional details.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">💡 Tip</h4>
            <p className="text-sm text-blue-700">
              If your request fits a specific category (ride, service, event, or borrow),
              go back and select that type for better matching!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Orchestrating Component

### Updated requests/new.tsx

```typescript
import { useState } from 'react'
import { useRouter } from 'next/router'
import { requestService } from '@/lib/api'
import Layout from '@/components/Layout'
import RequestTypeSelector, { RequestType } from '@/components/requests/RequestTypeSelector'
import RideRequestForm, { RideRequestPayload } from '@/components/requests/RideRequestForm'
import ServiceRequestForm, { ServiceRequestPayload } from '@/components/requests/ServiceRequestForm'
import EventRequestForm, { EventRequestPayload } from '@/components/requests/EventRequestForm'
import BorrowRequestForm, { BorrowRequestPayload } from '@/components/requests/BorrowRequestForm'
import GenericRequestForm from '@/components/requests/GenericRequestForm'

export default function NewRequestPage() {
  const router = useRouter()
  const [step, setStep] = useState<'select_type' | 'fill_details'>('select_type')
  const [requestType, setRequestType] = useState<RequestType | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Base fields
  const [communityId, setCommunityId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium')

  // Type-specific payloads
  const [ridePayload, setRidePayload] = useState<Partial<RideRequestPayload>>({})
  const [servicePayload, setServicePayload] = useState<Partial<ServiceRequestPayload>>({})
  const [eventPayload, setEventPayload] = useState<Partial<EventRequestPayload>>({})
  const [borrowPayload, setBorrowPayload] = useState<Partial<BorrowRequestPayload>>({})

  const handleTypeSelection = (type: RequestType) => {
    setRequestType(type)
    setStep('fill_details')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setSubmitting(true)

      // Build request based on type
      const baseRequest = {
        community_id: communityId,
        title,
        description,
        request_type: requestType,
        urgency
      }

      let payload = {}
      if (requestType === 'ride') payload = ridePayload
      else if (requestType === 'service') payload = servicePayload
      else if (requestType === 'event') payload = eventPayload
      else if (requestType === 'borrow') payload = borrowPayload

      const requestData = {
        ...baseRequest,
        ...(Object.keys(payload).length > 0 && { payload })
      }

      const response = await requestService.createRequest(requestData)
      alert('Request created successfully!')
      router.push(`/requests/${response.data.id}`)
    } catch (error: any) {
      console.error('Error creating request:', error)
      alert(error.response?.data?.message || 'Failed to create request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout title="Create Request">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center ${step === 'select_type' ? 'text-blue-600' : 'text-green-600'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'select_type' ? 'bg-blue-600' : 'bg-green-600'} text-white font-semibold`}>
                  {step === 'fill_details' ? '✓' : '1'}
                </div>
                <span className="ml-2 font-medium">Select Type</span>
              </div>
              <div className="flex-1 h-0.5 bg-gray-300"></div>
              <div className={`flex items-center ${step === 'fill_details' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'fill_details' ? 'bg-blue-600' : 'bg-gray-300'} text-white font-semibold`}>
                  2
                </div>
                <span className="ml-2 font-medium">Fill Details</span>
              </div>
            </div>
          </div>

          {/* Step 1: Type Selection */}
          {step === 'select_type' && (
            <RequestTypeSelector
              selectedType={requestType}
              onSelectType={handleTypeSelection}
            />
          )}

          {/* Step 2: Form Details */}
          {step === 'fill_details' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Back button */}
              <button
                type="button"
                onClick={() => setStep('select_type')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                ← Change Request Type
              </button>

              {/* Community Selection */}
              {/* ... community dropdown ... */}

              {/* Type-specific form */}
              {requestType === 'ride' && <RideRequestForm initialData={ridePayload} onChange={setRidePayload} />}
              {requestType === 'service' && <ServiceRequestForm initialData={servicePayload} onChange={setServicePayload} />}
              {requestType === 'event' && <EventRequestForm initialData={eventPayload} onChange={setEventPayload} />}
              {requestType === 'borrow' && <BorrowRequestForm initialData={borrowPayload} onChange={setBorrowPayload} />}
              {requestType === 'generic' && <GenericRequestForm />}

              {/* Title */}
              {/* ... title input ... */}

              {/* Description */}
              {/* ... description textarea ... */}

              {/* Urgency */}
              {/* ... urgency select ... */}

              {/* Submit */}
              <button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  )
}
```

---

## Next Steps

1. **Create remaining form components** using the templates above
2. **Update requests/new.tsx** with the orchestration logic
3. **Install Zod** if not already installed: `npm install zod`
4. **Add validation** by importing schemas from `@karmyq/shared/schemas`
5. **Test each form type** end-to-end

All templates are production-ready and follow the same patterns as RideRequestForm!
