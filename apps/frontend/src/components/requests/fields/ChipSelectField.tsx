import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'

interface ChipSelectFieldProps {
  field: UIField
  value: string[]
  onChange: (value: string[]) => void
  accentColor?: string
}

const colorMap: Record<string, { border: string; bg: string; text: string }> = {
  blue: { border: 'border-primary', bg: 'bg-primary-light', text: 'text-primary-dark' },
  green: { border: 'border-karmyq-teal-500', bg: 'bg-success-light', text: 'text-karmyq-teal-900' },
  purple: { border: 'border-accent', bg: 'bg-accent-light', text: 'text-accent-dark' },
  orange: { border: 'border-karmyq-brown-500', bg: 'bg-karmyq-brown-50', text: 'text-karmyq-brown-900' },
  gray: { border: 'border-karmyq-brown-500', bg: 'bg-surface', text: 'text-text' },
}

export default function ChipSelectField({ field, value, onChange, accentColor = 'blue' }: ChipSelectFieldProps) {
  const colors = colorMap[accentColor] || colorMap.blue
  const selected = value || []

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val))
    } else {
      onChange([...selected, val])
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-2">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {field.options?.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`px-3 py-1 text-sm rounded-full border-2 transition-all ${
              selected.includes(opt.value)
                ? `${colors.border} ${colors.bg} ${colors.text}`
                : 'border-border text-text-muted hover:border-karmyq-brown-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {field.helpText && (
        <p className="text-text-subtle text-sm mt-1">{field.helpText}</p>
      )}
    </div>
  )
}
