import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'

interface ButtonGroupFieldProps {
  field: UIField
  value: string
  onChange: (value: string) => void
  accentColor?: string
}

const colorMap: Record<string, { border: string; bg: string; ring: string }> = {
  blue: { border: 'border-primary', bg: 'bg-primary-light', ring: 'ring-primary' },
  green: { border: 'border-karmyq-teal-500', bg: 'bg-success-light', ring: 'ring-karmyq-teal-500' },
  purple: { border: 'border-karmyq-orange-500', bg: 'bg-accent-light', ring: 'ring-accent' },
  orange: { border: 'border-karmyq-brown-500', bg: 'bg-karmyq-brown-50', ring: 'ring-karmyq-brown-500' },
  gray: { border: 'border-karmyq-brown-500', bg: 'bg-surface', ring: 'ring-karmyq-brown-500' },
}

export default function ButtonGroupField({ field, value, onChange, accentColor = 'blue' }: ButtonGroupFieldProps) {
  const colors = colorMap[accentColor] || colorMap.blue

  // Use grid layout: 3 columns for small option sets, 5 for large
  const cols = (field.options?.length || 0) <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'

  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-3">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      <div className={`grid ${cols} gap-3`}>
        {field.options?.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`p-3 border-2 rounded-lg text-center transition-all ${
              value === opt.value
                ? `${colors.border} ${colors.bg} ring-2 ${colors.ring}`
                : 'border-border hover:border-karmyq-brown-400'
            }`}
          >
            {opt.icon && <div className="text-2xl mb-1">{opt.icon}</div>}
            <div className="text-xs font-medium text-text">{opt.label}</div>
          </button>
        ))}
      </div>
      {field.helpText && (
        <p className="text-text-subtle text-sm mt-1">{field.helpText}</p>
      )}
    </div>
  )
}
