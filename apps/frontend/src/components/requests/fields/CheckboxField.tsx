import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'

interface CheckboxFieldProps {
  field: UIField
  value: boolean
  onChange: (value: boolean) => void
}

export default function CheckboxField({ field, value, onChange }: CheckboxFieldProps) {
  return (
    <label className="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-surface cursor-pointer">
      <input
        type="checkbox"
        checked={value || false}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border rounded"
      />
      <div className="flex-1">
        <span className="font-medium text-text">{field.label}</span>
        {field.helpText && (
          <p className="text-sm text-text-subtle">{field.helpText}</p>
        )}
      </div>
    </label>
  )
}
