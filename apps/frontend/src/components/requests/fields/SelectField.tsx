import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'

interface SelectFieldProps {
  field: UIField
  value: string
  onChange: (value: string) => void
}

export default function SelectField({ field, value, onChange }: SelectFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-2">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
      >
        <option value="">{field.placeholder || 'Select...'}</option>
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {field.helpText && (
        <p className="text-text-subtle text-sm mt-1">{field.helpText}</p>
      )}
    </div>
  )
}
