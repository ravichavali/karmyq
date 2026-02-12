/**
 * DateTime Picker Component
 * For selecting dates and times with ISO 8601 output
 */

import React from 'react'

interface DateTimePickerProps {
  label: string
  value: string
  onChange: (isoString: string) => void
  required?: boolean
  minDate?: string
  helpText?: string
}

export default function DateTimePicker({
  label,
  value,
  onChange,
  required = false,
  minDate,
  helpText
}: DateTimePickerProps) {
  // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
  const toLocalDatetime = (isoString: string) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    return date.toISOString().slice(0, 16)
  }

  // Convert datetime-local to ISO string
  const toISOString = (localDatetime: string) => {
    if (!localDatetime) return ''
    return new Date(localDatetime).toISOString()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(toISOString(e.target.value))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        type="datetime-local"
        value={toLocalDatetime(value)}
        onChange={handleChange}
        min={minDate ? toLocalDatetime(minDate) : undefined}
        required={required}
        className="w-full border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
      />

      {helpText && (
        <p className="text-text-subtle text-sm mt-1">{helpText}</p>
      )}
    </div>
  )
}
