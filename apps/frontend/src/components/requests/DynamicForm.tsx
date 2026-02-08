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

interface DynamicFormProps {
  schema: UISchema
  value: Record<string, any>
  onChange: (value: Record<string, any>) => void
}

/**
 * Get a nested value from an object using a dotted path.
 * e.g., getNestedValue({ preferences: { women_only: true } }, 'preferences.women_only') → true
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split('.')
  let current: any = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

/**
 * Set a nested value in an object using a dotted path. Returns a new object.
 * e.g., setNestedValue({}, 'preferences.women_only', true) → { preferences: { women_only: true } }
 */
function setNestedValue(obj: Record<string, any>, path: string, value: any): Record<string, any> {
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
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
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

function SummaryPanel({ schema, value }: { schema: UISchema; value: Record<string, any> }) {
  if (!schema.summary) return null

  const entries = schema.summary.fields
    .map((key) => {
      const raw = getNestedValue(value, key)
      if (raw == null || raw === '') return null
      const label = schema.summary!.labels?.[key] || key

      // Format value for display
      let display: string
      if (typeof raw === 'object' && raw.address) {
        display = raw.address
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
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
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
  const handleFieldChange = (field: UIField, fieldValue: any) => {
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
