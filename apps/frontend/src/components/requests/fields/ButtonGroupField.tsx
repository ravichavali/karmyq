import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'

interface ButtonGroupFieldProps {
  field: UIField
  value: string
  onChange: (value: string) => void
  accentColor?: string
}

const colorMap: Record<string, { border: string; bg: string; ring: string }> = {
  blue: { border: 'border-blue-500', bg: 'bg-blue-50', ring: 'ring-blue-500' },
  green: { border: 'border-green-500', bg: 'bg-green-50', ring: 'ring-green-500' },
  purple: { border: 'border-purple-500', bg: 'bg-purple-50', ring: 'ring-purple-500' },
  orange: { border: 'border-orange-500', bg: 'bg-orange-50', ring: 'ring-orange-500' },
  gray: { border: 'border-gray-500', bg: 'bg-gray-50', ring: 'ring-gray-500' },
}

export default function ButtonGroupField({ field, value, onChange, accentColor = 'blue' }: ButtonGroupFieldProps) {
  const colors = colorMap[accentColor] || colorMap.blue

  // Use grid layout: 3 columns for small option sets, 5 for large
  const cols = (field.options?.length || 0) <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
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
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {opt.icon && <div className="text-2xl mb-1">{opt.icon}</div>}
            <div className="text-xs font-medium text-gray-900">{opt.label}</div>
          </button>
        ))}
      </div>
      {field.helpText && (
        <p className="text-gray-500 text-sm mt-1">{field.helpText}</p>
      )}
    </div>
  )
}
