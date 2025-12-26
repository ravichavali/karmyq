/**
 * Service Request Form Component
 * For requesting professional services, repairs, tutoring, etc.
 */

import React, { useState } from 'react'

export interface ServiceRequestPayload {
  service_category: string
  skill_level_required?: 'beginner' | 'intermediate' | 'expert'
  estimated_duration_hours?: number
  location_type?: 'remote' | 'on_site' | 'hybrid'
  certifications_required?: string[]
  budget_range?: {
    min: number
    max: number
    currency: 'USD' | 'EUR' | 'GBP'
  }
  preferred_schedule?: {
    days: string[]
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'flexible'
  }
}

interface ServiceRequestFormProps {
  initialData?: Partial<ServiceRequestPayload>
  onChange: (payload: Partial<ServiceRequestPayload>) => void
}

const SERVICE_CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing', icon: '🔧' },
  { value: 'electrical', label: 'Electrical', icon: '⚡' },
  { value: 'carpentry', label: 'Carpentry', icon: '🔨' },
  { value: 'tutoring', label: 'Tutoring', icon: '📚' },
  { value: 'consulting', label: 'Consulting', icon: '💼' },
  { value: 'repair', label: 'Repair', icon: '🛠️' },
  { value: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { value: 'gardening', label: 'Gardening', icon: '🌱' },
  { value: 'pet_care', label: 'Pet Care', icon: '🐾' },
  { value: 'childcare', label: 'Childcare', icon: '👶' },
  { value: 'elder_care', label: 'Elder Care', icon: '👵' },
  { value: 'tech_support', label: 'Tech Support', icon: '💻' },
  { value: 'legal', label: 'Legal', icon: '⚖️' },
  { value: 'financial', label: 'Financial', icon: '💰' },
  { value: 'other', label: 'Other', icon: '📋' },
]

const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
]

export default function ServiceRequestForm({ initialData, onChange }: ServiceRequestFormProps) {
  const [formData, setFormData] = useState<Partial<ServiceRequestPayload>>(initialData || {})

  const updateField = (field: keyof ServiceRequestPayload, value: any) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    onChange(updated)
  }

  const updateBudget = (field: 'min' | 'max' | 'currency', value: any) => {
    const updated = {
      ...formData,
      budget_range: {
        min: formData.budget_range?.min || 0,
        max: formData.budget_range?.max || 0,
        currency: formData.budget_range?.currency || 'USD' as const,
        [field]: value
      }
    }
    setFormData(updated)
    onChange(updated)
  }

  const updateSchedule = (field: 'days' | 'time_of_day', value: any) => {
    const updated = {
      ...formData,
      preferred_schedule: {
        days: formData.preferred_schedule?.days || [],
        time_of_day: formData.preferred_schedule?.time_of_day || 'flexible' as const,
        [field]: value
      }
    }
    setFormData(updated)
    onChange(updated)
  }

  const toggleDay = (day: string) => {
    const currentDays = formData.preferred_schedule?.days || []
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day]
    updateSchedule('days', newDays)
  }

  return (
    <div className="space-y-6">
      {/* Service Category Header */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-1">🔧 Service Request</h3>
        <p className="text-sm text-green-700">
          Request professional services, repairs, or expertise from community helpers
        </p>
      </div>

      {/* Service Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Service Category <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {SERVICE_CATEGORIES.map(category => (
            <button
              key={category.value}
              type="button"
              onClick={() => updateField('service_category', category.value)}
              className={`
                p-3 border-2 rounded-lg text-center transition-all
                ${formData.service_category === category.value
                  ? 'border-green-500 bg-green-50 ring-2 ring-green-500'
                  : 'border-gray-300 hover:border-green-400'
                }
              `}
            >
              <div className="text-2xl mb-1">{category.icon}</div>
              <div className="text-xs font-medium text-gray-900">{category.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Skill Level Required */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Skill Level Required (Optional)
        </label>
        <select
          value={formData.skill_level_required || ''}
          onChange={(e) => updateField('skill_level_required', e.target.value || undefined)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="">Any skill level</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="expert">Expert</option>
        </select>
      </div>

      {/* Location Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Location Type (Optional)
        </label>
        <div className="flex gap-3">
          {[
            { value: 'on_site', label: 'On-Site', icon: '🏠' },
            { value: 'remote', label: 'Remote', icon: '💻' },
            { value: 'hybrid', label: 'Hybrid', icon: '🔄' }
          ].map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => updateField('location_type', type.value)}
              className={`
                flex-1 p-3 border-2 rounded-lg transition-all
                ${formData.location_type === type.value
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-green-400'
                }
              `}
            >
              <div className="text-xl mb-1">{type.icon}</div>
              <div className="text-sm font-medium">{type.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Estimated Duration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Estimated Duration (Optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0.5"
            max="80"
            step="0.5"
            value={formData.estimated_duration_hours || ''}
            onChange={(e) => updateField('estimated_duration_hours', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="2"
            className="w-32 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <span className="text-sm text-gray-600">hours</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">How long do you expect this service to take?</p>
      </div>

      {/* Budget Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Budget Range (Optional)
        </label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <input
              type="number"
              min="0"
              value={formData.budget_range?.min || ''}
              onChange={(e) => updateBudget('min', e.target.value ? parseFloat(e.target.value) : 0)}
              placeholder="Min"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <input
              type="number"
              min="0"
              value={formData.budget_range?.max || ''}
              onChange={(e) => updateBudget('max', e.target.value ? parseFloat(e.target.value) : 0)}
              placeholder="Max"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={formData.budget_range?.currency || 'USD'}
              onChange={(e) => updateBudget('currency', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preferred Schedule */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Preferred Schedule (Optional)
        </label>

        {/* Days of Week */}
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-2">Preferred days:</p>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`
                  px-3 py-1 text-sm rounded-full border-2 transition-all
                  ${(formData.preferred_schedule?.days || []).includes(day)
                    ? 'border-green-500 bg-green-50 text-green-900'
                    : 'border-gray-300 text-gray-700 hover:border-green-400'
                  }
                `}
              >
                {day.charAt(0).toUpperCase() + day.slice(1, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Time of Day */}
        <div>
          <p className="text-xs text-gray-600 mb-2">Preferred time:</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: 'morning', label: 'Morning', icon: '🌅' },
              { value: 'afternoon', label: 'Afternoon', icon: '☀️' },
              { value: 'evening', label: 'Evening', icon: '🌆' },
              { value: 'flexible', label: 'Flexible', icon: '🔄' }
            ].map(time => (
              <button
                key={time.value}
                type="button"
                onClick={() => updateSchedule('time_of_day', time.value)}
                className={`
                  p-2 border-2 rounded-lg text-center transition-all
                  ${formData.preferred_schedule?.time_of_day === time.value
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-green-400'
                  }
                `}
              >
                <div className="text-lg mb-1">{time.icon}</div>
                <div className="text-xs font-medium">{time.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      {formData.service_category && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2">Service Summary</h4>
          <div className="space-y-1 text-sm text-green-800">
            <p>
              <strong>Service:</strong> {SERVICE_CATEGORIES.find(c => c.value === formData.service_category)?.label}
            </p>
            {formData.skill_level_required && (
              <p><strong>Skill Level:</strong> {formData.skill_level_required}</p>
            )}
            {formData.location_type && (
              <p><strong>Location:</strong> {formData.location_type}</p>
            )}
            {formData.estimated_duration_hours && (
              <p><strong>Duration:</strong> {formData.estimated_duration_hours} hours</p>
            )}
            {formData.budget_range && formData.budget_range.min > 0 && formData.budget_range.max > 0 && (
              <p>
                <strong>Budget:</strong> {formData.budget_range.currency} {formData.budget_range.min} - {formData.budget_range.max}
              </p>
            )}
            {formData.preferred_schedule?.days && formData.preferred_schedule.days.length > 0 && (
              <p>
                <strong>Days:</strong> {formData.preferred_schedule.days.join(', ')}
              </p>
            )}
            {formData.preferred_schedule?.time_of_day && formData.preferred_schedule.time_of_day !== 'flexible' && (
              <p><strong>Time:</strong> {formData.preferred_schedule.time_of_day}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
