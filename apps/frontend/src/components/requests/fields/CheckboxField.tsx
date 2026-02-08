import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'

interface CheckboxFieldProps {
  field: UIField
  value: boolean
  onChange: (value: boolean) => void
}

export default function CheckboxField({ field, value, onChange }: CheckboxFieldProps) {
  return (
    <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
      <input
        type="checkbox"
        checked={value || false}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      <div className="flex-1">
        <span className="font-medium text-gray-900">{field.label}</span>
        {field.helpText && (
          <p className="text-sm text-gray-500">{field.helpText}</p>
        )}
      </div>
    </label>
  )
}
