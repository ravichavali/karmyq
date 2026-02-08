import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'
import LocationPicker, { Location } from '../shared/LocationPicker'

interface LocationFieldProps {
  field: UIField
  value: Location | null
  onChange: (value: Location) => void
}

export default function LocationField({ field, value, onChange }: LocationFieldProps) {
  return (
    <LocationPicker
      label={field.label}
      value={value}
      onChange={onChange}
      placeholder={field.placeholder}
      required={field.required}
    />
  )
}
