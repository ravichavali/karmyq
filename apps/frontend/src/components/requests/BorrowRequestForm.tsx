/**
 * Borrow Request Form Component
 * For borrowing tools, equipment, or other items
 */

import React, { useState } from 'react'
import DateTimePicker from './shared/DateTimePicker'

export interface BorrowRequestPayload {
  item_category: string
  duration_days: number
  condition_min?: 'fair' | 'good' | 'like_new' | 'new'
  return_date?: string
  images?: string[]
}

interface BorrowRequestFormProps {
  initialData?: Partial<BorrowRequestPayload>
  onChange: (payload: Partial<BorrowRequestPayload>) => void
}

const ITEM_CATEGORIES = [
  { value: 'tools', label: 'Tools', icon: '🔧', examples: 'Hammer, drill, saw' },
  { value: 'electronics', label: 'Electronics', icon: '💻', examples: 'Laptop, camera, speaker' },
  { value: 'kitchen', label: 'Kitchen', icon: '🍳', examples: 'Mixer, appliances' },
  { value: 'books', label: 'Books', icon: '📚', examples: 'Textbooks, novels' },
  { value: 'sports', label: 'Sports', icon: '⚽', examples: 'Bike, equipment' },
  { value: 'camping', label: 'Camping', icon: '⛺', examples: 'Tent, sleeping bag' },
  { value: 'party', label: 'Party', icon: '🎈', examples: 'Tables, decorations' },
  { value: 'other', label: 'Other', icon: '📋', examples: 'Miscellaneous items' },
]

export default function BorrowRequestForm({ initialData, onChange }: BorrowRequestFormProps) {
  const [formData, setFormData] = useState<Partial<BorrowRequestPayload>>(initialData || {})

  const updateField = (field: keyof BorrowRequestPayload, value: any) => {
    const updated = { ...formData, [field]: value }
    setFormData(updated)
    onChange(updated)
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  return (
    <div className="space-y-6">
      {/* Borrow Header */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h3 className="font-semibold text-orange-900 mb-1">📦 Borrow Request</h3>
        <p className="text-sm text-orange-700">
          Borrow tools, equipment, or items from community members
        </p>
      </div>

      {/* Item Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          What do you need to borrow? <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ITEM_CATEGORIES.map(category => (
            <button
              key={category.value}
              type="button"
              onClick={() => updateField('item_category', category.value)}
              className={`
                p-4 border-2 rounded-lg text-left transition-all
                ${formData.item_category === category.value
                  ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500'
                  : 'border-gray-300 hover:border-orange-400'
                }
              `}
            >
              <div className="flex items-start space-x-3">
                <span className="text-3xl flex-shrink-0">{category.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">{category.label}</div>
                  <div className="text-xs text-gray-600">{category.examples}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          How long do you need it? <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {[1, 2, 3, 7, 14, 30].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => updateField('duration_days', days)}
              className={`
                p-3 border-2 rounded-lg text-center transition-all
                ${formData.duration_days === days
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-300 hover:border-orange-400'
                }
              `}
            >
              <div className="text-lg font-bold text-gray-900">{days}</div>
              <div className="text-xs text-gray-600">{days === 1 ? 'day' : 'days'}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Or custom:</span>
          <input
            type="number"
            min="1"
            max="30"
            value={formData.duration_days || ''}
            onChange={(e) => updateField('duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="Days"
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <span className="text-sm text-gray-600">days (max 30)</span>
        </div>
      </div>

      {/* Return Date */}
      <DateTimePicker
        label="Expected Return Date (Optional)"
        value={formData.return_date || ''}
        onChange={(datetime) => updateField('return_date', datetime)}
        minDate={tomorrow.toISOString()}
        helpText="When will you return this item?"
      />

      {/* Condition Minimum */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Minimum Condition (Optional)
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: 'fair', label: 'Fair', icon: '⭐', desc: 'Shows wear' },
            { value: 'good', label: 'Good', icon: '⭐⭐', desc: 'Working well' },
            { value: 'like_new', label: 'Like New', icon: '⭐⭐⭐', desc: 'Minimal use' },
            { value: 'new', label: 'New', icon: '⭐⭐⭐⭐', desc: 'Unused' }
          ].map(condition => (
            <button
              key={condition.value}
              type="button"
              onClick={() => updateField('condition_min', condition.value)}
              className={`
                p-3 border-2 rounded-lg text-center transition-all
                ${formData.condition_min === condition.value
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-300 hover:border-orange-400'
                }
              `}
            >
              <div className="text-xs mb-1">{condition.icon}</div>
              <div className="text-sm font-medium text-gray-900">{condition.label}</div>
              <div className="text-xs text-gray-600">{condition.desc}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          What's the minimum acceptable condition for the item?
        </p>
      </div>

      {/* Usage Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">💡 Tips for Borrowing</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Be specific in your title and description about what you need</li>
          <li>• Mention your experience level with the item</li>
          <li>• Offer to pick up and return the item yourself</li>
          <li>• Consider offering a deposit for expensive items</li>
        </ul>
      </div>

      {/* Summary */}
      {formData.item_category && formData.duration_days && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-semibold text-orange-900 mb-2">Borrow Summary</h4>
          <div className="space-y-1 text-sm text-orange-800">
            <p>
              <strong>Category:</strong> {ITEM_CATEGORIES.find(c => c.value === formData.item_category)?.label}
            </p>
            <p><strong>Duration:</strong> {formData.duration_days} {formData.duration_days === 1 ? 'day' : 'days'}</p>
            {formData.return_date && (
              <p><strong>Return By:</strong> {new Date(formData.return_date).toLocaleDateString()}</p>
            )}
            {formData.condition_min && (
              <p><strong>Minimum Condition:</strong> {formData.condition_min}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
