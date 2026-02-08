import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'

interface ChipSelectFieldProps {
  field: UIField
  value: string[]
  onChange: (value: string[]) => void
  accentColor?: string
}

const colorMap: Record<string, { border: string; bg: string; text: string }> = {
  blue: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-900' },
  green: { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-900' },
  purple: { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-900' },
  orange: { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-900' },
  gray: { border: 'border-gray-500', bg: 'bg-gray-50', text: 'text-gray-900' },
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
      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                : 'border-gray-300 text-gray-700 hover:border-gray-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {field.helpText && (
        <p className="text-gray-500 text-sm mt-1">{field.helpText}</p>
      )}
    </div>
  )
}
