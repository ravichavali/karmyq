import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'

interface RangeFieldProps {
  field: UIField
  value: { min?: number; max?: number; currency?: string }
  onChange: (value: { min?: number; max?: number; currency?: string }) => void
}

export default function RangeField({ field, value, onChange }: RangeFieldProps) {
  const current = value || {}

  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-2">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <input
            type="number"
            value={current.min ?? ''}
            onChange={(e) => onChange({ ...current, min: e.target.value ? parseFloat(e.target.value) : undefined })}
            min={field.min}
            placeholder={field.minLabel || 'Min'}
            className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <input
            type="number"
            value={current.max ?? ''}
            onChange={(e) => onChange({ ...current, max: e.target.value ? parseFloat(e.target.value) : undefined })}
            min={field.min}
            placeholder={field.maxLabel || 'Max'}
            className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <select
            value={current.currency || field.unit || 'USD'}
            onChange={(e) => onChange({ ...current, currency: e.target.value })}
            className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>
      {field.helpText && (
        <p className="text-text-subtle text-sm mt-1">{field.helpText}</p>
      )}
    </div>
  )
}
