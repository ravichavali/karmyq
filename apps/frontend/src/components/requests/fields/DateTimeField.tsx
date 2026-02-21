import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'
import DateTimePicker from '../shared/DateTimePicker'

interface DateTimeFieldProps {
  field: UIField
  value: string
  onChange: (value: string) => void
}

export default function DateTimeField({ field, value, onChange }: DateTimeFieldProps) {
  return (
    <DateTimePicker
      label={field.label}
      value={value || ''}
      onChange={onChange}
      required={field.required}
      helpText={field.helpText}
    />
  )
}
