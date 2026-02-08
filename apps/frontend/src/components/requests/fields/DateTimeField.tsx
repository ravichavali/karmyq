import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'
import DateTimePicker from '../shared/DateTimePicker'

interface DateTimeFieldProps {
  field: UIField
  value: string
  onChange: (value: string) => void
}

export default function DateTimeField({ field, value, onChange }: DateTimeFieldProps) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  return (
    <DateTimePicker
      label={field.label}
      value={value || ''}
      onChange={onChange}
      required={field.required}
      minDate={tomorrow.toISOString()}
      helpText={field.helpText}
    />
  )
}
