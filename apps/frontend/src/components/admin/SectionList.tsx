import { useState } from 'react'
import SectionHeader from './SectionHeader'

export interface SectionProps {
  sections: Array<{
    id: string
    title: string
    fields: any[]
  }>
  onToggle?: (sectionId: string) => void
  onDelete?: (sectionId: string) => void
  onEdit?: (section: any, updates: any) => void
}

export default function SectionList({ sections, onToggle, onDelete, onEdit }: SectionProps) {
  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <div key={section.id} className="border border-border rounded-lg bg-surface p-4">
          <SectionHeader
            section={section}
            onToggle={onToggle}
            onDelete={onDelete}
            onEdit={onEdit}
          />
          <div className="space-y-2 mt-3">
            {section.fields.map((field, fieldIndex) => (
              <div key={field.id} className="bg-surface rounded p-3 mb-2 border border-border">
                <span className="text-sm text-text-muted">{field.label} ({field.type})</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
