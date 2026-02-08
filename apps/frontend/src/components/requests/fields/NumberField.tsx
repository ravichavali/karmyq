import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'

interface NumberFieldProps {
  field: UIField
  value: number | undefined
  onChange: (value: number | undefined) => void
}

export default function NumberField({ field, value, onChange }: NumberFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
          min={field.min}
          max={field.max}
          step={field.step}
          placeholder={field.placeholder}
          required={field.required}
          className="w-32 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {field.unit && <span className="text-sm text-gray-600">{field.unit}</span>}
      </div>
      {field.helpText && (
        <p className="text-gray-500 text-sm mt-1">{field.helpText}</p>
      )}
    </div>
  )
}
