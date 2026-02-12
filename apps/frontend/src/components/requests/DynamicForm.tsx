/**
 * DynamicForm — Server-Driven UI Form Renderer
 *
 * Renders a polymorphic request form from a UISchema definition.
 * The schema is fetched from the backend (GET /schemas/:type) and
 * describes sections, fields, components, and layout.
 *
 * Usage:
 *   <DynamicForm schema={rideSchema} value={payload} onChange={setPayload} />
 */

import React from 'react'
import type { UISchema, UISection, UIField } from '@karmyq/shared/schemas/ui'
import FieldRenderer from './fields/FieldRenderer'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormValue = Record<string, any>

interface DynamicFormProps {
  schema: UISchema
  value: FormValue
  onChange: (value: FormValue) => void
}

/**
 * Get a nested value from an object using a dotted path.
 * e.g., getNestedValue({ preferences: { women_only: true } }, 'preferences.women_only') → true
 */
function getNestedValue(obj: FormValue, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = (current as FormValue)[part]
  }
  return current
}

/**
 * Set a nested value in an object using a dotted path. Returns a new object.
 * e.g., setNestedValue({}, 'preferences.women_only', true) → { preferences: { women_only: true } }
 */
function setNestedValue(obj: FormValue, path: string, value: unknown): FormValue {
  const parts = path.split('.')
  if (parts.length === 1) {
    return { ...obj, [parts[0]]: value }
  }

  const [first, ...rest] = parts
  return {
    ...obj,
    [first]: setNestedValue(
      (obj[first] != null && typeof obj[first] === 'object') ? obj[first] : {},
      rest.join('.'),
      value
    ),
  }
}

function SectionHeader({ section, schema }: { section: UISection; schema: UISchema }) {
  const color = section.color || schema.color
  const colorClasses: Record<string, string> = {
    blue: 'bg-primary-light border-primary-medium text-primary-dark',
    green: 'bg-success-light border-success text-karmyq-teal-900',
    purple: 'bg-accent-light border-accent text-karmyq-orange-900',
    orange: 'bg-karmyq-brown-50 border-karmyq-brown-200 text-karmyq-brown-900',
    gray: 'bg-surface border-border text-text',
  }
  const cls = colorClasses[color] || colorClasses.gray

  return (
    <div className={`border rounded-lg p-4 ${cls}`}>
      <h3 className="font-semibold mb-1">
        {section.icon && <span className="mr-1">{section.icon}</span>}
        {section.title}
      </h3>
      {section.description && (
        <p className="text-sm opacity-80">{section.description}</p>
      )}
    </div>
  )
}

function SummaryPanel({ schema, value }: { schema: UISchema; value: FormValue }) {
  if (!schema.summary) return null

  const entries = schema.summary.fields
    .map((key) => {
      const raw = getNestedValue(value, key)
      if (raw == null || raw === '') return null
      const label = schema.summary!.labels?.[key] || key

      // Format value for display
      let display: string
      if (typeof raw === 'object' && raw !== null && 'address' in raw) {
        display = String((raw as FormValue).address)
      } else if (typeof raw === 'string' && raw.includes('T')) {
        // ISO datetime
        try { display = new Date(raw).toLocaleString() } catch { display = raw }
      } else {
        display = String(raw)
      }

      return { label, display }
    })
    .filter(Boolean)

  if (entries.length === 0) return null

  const color = schema.color || 'gray'
  const colorClasses: Record<string, string> = {
    blue: 'bg-primary-light border-primary-medium text-primary-dark',
    green: 'bg-success-light border-success text-karmyq-teal-900',
    purple: 'bg-accent-light border-accent text-karmyq-orange-900',
    orange: 'bg-karmyq-brown-50 border-karmyq-brown-200 text-karmyq-brown-900',
    gray: 'bg-surface border-border text-text',
  }
  const cls = colorClasses[color] || colorClasses.gray

  return (
    <div className={`border rounded-lg p-4 ${cls}`}>
      <h4 className="font-semibold mb-2">Summary</h4>
      <div className="space-y-1 text-sm">
        {entries.map((entry) => (
          <p key={entry!.label}>
            <strong>{entry!.label}:</strong> {entry!.display}
          </p>
        ))}
      </div>
    </div>
  )
}

export default function DynamicForm({ schema, value, onChange }: DynamicFormProps) {
  const handleFieldChange = (field: UIField, fieldValue: unknown) => {
    const updated = setNestedValue(value, field.key, fieldValue)
    onChange(updated)
  }

  // If no sections (e.g., generic type), render nothing
  if (schema.sections.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {schema.sections.map((section) => (
        <div key={section.id} className="space-y-4">
          <SectionHeader section={section} schema={schema} />

          {section.fields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={getNestedValue(value, field.key)}
              onChange={(fieldValue) => handleFieldChange(field, fieldValue)}
              accentColor={section.color || schema.color}
            />
          ))}
        </div>
      ))}

      <SummaryPanel schema={schema} value={value} />
    </div>
  )
}
