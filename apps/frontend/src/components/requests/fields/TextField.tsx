import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'

interface TextFieldProps {
  field: UIField
  value: string
  onChange: (value: string) => void
}

export default function TextField({ field, value, onChange }: TextFieldProps) {
  const isTextarea = field.type === 'textarea'

  return (
    <div>
      {field.label && (
        <label className="block text-sm font-medium text-text-muted mb-2">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
      )}
      {isTextarea ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={4}
          className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      )}
      {field.helpText && (
        <p className="text-text-subtle text-sm mt-1">{field.helpText}</p>
      )}
    </div>
  )
}
