import React from 'react'
import type { UIField } from '@karmyq/shared/schemas/ui'
import TextField from './TextField'
import NumberField from './NumberField'
import SelectField from './SelectField'
import ButtonGroupField from './ButtonGroupField'
import ChipSelectField from './ChipSelectField'
import CheckboxField from './CheckboxField'
import RangeField from './RangeField'
import LocationField from './LocationField'
import DateTimeField from './DateTimeField'

interface FieldRendererProps {
  field: UIField
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (value: any) => void
  accentColor?: string
}

/**
 * FieldRenderer — dispatches to the correct field component based on field.type.
 * This is the component registry for Server-Driven UI.
 */
export default function FieldRenderer({ field, value, onChange, accentColor }: FieldRendererProps) {
  switch (field.type) {
    case 'text':
    case 'textarea':
      return <TextField field={field} value={value} onChange={onChange} />

    case 'number':
      return <NumberField field={field} value={value} onChange={onChange} />

    case 'select':
      return <SelectField field={field} value={value} onChange={onChange} />

    case 'button_group':
      return <ButtonGroupField field={field} value={value} onChange={onChange} accentColor={accentColor} />

    case 'chip_select':
      return <ChipSelectField field={field} value={value} onChange={onChange} accentColor={accentColor} />

    case 'checkbox':
      return <CheckboxField field={field} value={value} onChange={onChange} />

    case 'range':
      return <RangeField field={field} value={value} onChange={onChange} />

    case 'location':
      return <LocationField field={field} value={value} onChange={onChange} />

    case 'datetime':
      return <DateTimeField field={field} value={value} onChange={onChange} />

    case 'object':
      // Render nested sub-fields
      return (
        <div className="space-y-4 pl-4 border-l-2 border-border">
          {field.fields?.map((subField) => (
            <FieldRenderer
              key={subField.key}
              field={subField}
              value={value?.[subField.key]}
              onChange={(subValue) => onChange({ ...value, [subField.key]: subValue })}
              accentColor={accentColor}
            />
          ))}
        </div>
      )

    default:
      return (
        <div className="text-sm text-text-subtle">
          Unknown field type: {field.type}
        </div>
      )
  }
}
