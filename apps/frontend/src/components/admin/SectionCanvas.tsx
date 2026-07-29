import { useState } from 'react'
import FieldEditor, { AdminField } from './FieldEditor'

interface AdminSection {
  id: string
  title: string
  description?: string
  fields: AdminField[]
}

const FIELD_TYPE_ICONS: Record<string, string> = {
  text: '✏️', textarea: '📝', number: '🔢', select: '▾',
  datetime: '📅', checkbox: '☑️', location: '📍',
  button_group: '⊙', chip_select: '🏷️', range: '↔️', object: '📦',
}

interface Props {
  sections: AdminSection[]
  onUpdateSection: (sectionId: string, updates: Partial<AdminSection>) => void
  onDeleteSection: (sectionId: string) => void
  onAddSection: () => void
  onAddField: (sectionId: string, type: string) => void
  onUpdateField: (sectionId: string, fieldId: string, updates: Partial<AdminField>) => void
  onDeleteField: (sectionId: string, fieldId: string) => void
  onMoveField: (sectionId: string, fromIndex: number, toIndex: number) => void
}

export default function SectionCanvas({
  sections,
  onUpdateSection,
  onDeleteSection,
  onAddSection,
  onAddField,
  onUpdateField,
  onDeleteField,
  onMoveField,
}: Props) {
  const [selectedField, setSelectedField] = useState<{ sectionId: string; fieldId: string } | null>(null)
  const [dragOverSection, setDragOverSection] = useState<string | null>(null)
  const [dragFieldInfo, setDragFieldInfo] = useState<{ sectionId: string; fieldIndex: number } | null>(null)
  const [dragOverFieldIndex, setDragOverFieldIndex] = useState<number | null>(null)
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionTitle, setEditingSectionTitle] = useState('')

  const handleSectionDrop = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault()
    setDragOverSection(null)

    // Drop from palette
    const paletteType = e.dataTransfer.getData('palette/fieldType')
    if (paletteType) {
      onAddField(sectionId, paletteType)
      return
    }

    // Reorder within section (handled by field drop handlers)
  }

  const handleFieldDragStart = (e: React.DragEvent, sectionId: string, fieldIndex: number) => {
    e.dataTransfer.setData('canvas/field', JSON.stringify({ sectionId, fieldIndex }))
    e.dataTransfer.effectAllowed = 'move'
    setDragFieldInfo({ sectionId, fieldIndex })
  }

  const handleFieldDrop = (e: React.DragEvent, sectionId: string, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    const raw = e.dataTransfer.getData('canvas/field')
    if (raw) {
      const { sectionId: fromSection, fieldIndex: fromIndex } = JSON.parse(raw)
      if (fromSection === sectionId && fromIndex !== targetIndex) {
        onMoveField(sectionId, fromIndex, targetIndex)
      }
    }

    setDragFieldInfo(null)
    setDragOverFieldIndex(null)
  }

  const handleFieldDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFieldIndex(index)
  }

  const isSelectedField = (sectionId: string, fieldId: string) =>
    selectedField?.sectionId === sectionId && selectedField?.fieldId === fieldId

  const startEditingSection = (section: AdminSection) => {
    setEditingSectionId(section.id)
    setEditingSectionTitle(section.title)
  }

  const commitSectionTitle = (sectionId: string) => {
    if (editingSectionTitle.trim()) {
      onUpdateSection(sectionId, { title: editingSectionTitle.trim() })
    }
    setEditingSectionId(null)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
      {sections.length === 0 && (
        <div className="text-center py-16 text-text-muted border-2 border-dashed border-border rounded-lg">
          <p className="text-sm mb-2">No sections yet</p>
          <p className="text-xs text-text-subtle">Click "+ Add section" below to start</p>
        </div>
      )}

      {sections.map((section) => (
        <div
          key={section.id}
          onDragOver={(e) => { e.preventDefault(); setDragOverSection(section.id) }}
          onDragLeave={() => setDragOverSection(null)}
          onDrop={(e) => handleSectionDrop(e, section.id)}
          className={`rounded-lg border-2 transition-colors ${
            dragOverSection === section.id
              ? 'border-primary bg-primary-light'
              : 'border-border bg-surface'
          }`}
        >
          {/* Section header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            {editingSectionId === section.id ? (
              <input
                autoFocus
                type="text"
                value={editingSectionTitle}
                onChange={(e) => setEditingSectionTitle(e.target.value)}
                onBlur={() => commitSectionTitle(section.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSectionTitle(section.id)
                  if (e.key === 'Escape') setEditingSectionId(null)
                }}
                className="flex-1 text-sm font-semibold bg-transparent border-b border-primary focus:outline-hidden"
              />
            ) : (
              <button
                onClick={() => startEditingSection(section)}
                className="flex-1 text-left text-sm font-semibold text-text hover:text-primary"
                title="Click to rename"
              >
                {section.title}
              </button>
            )}
            <button
              onClick={() => onDeleteSection(section.id)}
              className="text-xs text-text-subtle hover:text-red-600 px-2 py-1 rounded"
              title="Delete section"
            >
              ✕
            </button>
          </div>

          {/* Fields */}
          <div className="p-3 space-y-1">
            {section.fields.length === 0 && dragOverSection !== section.id && (
              <div className="text-center py-4 text-xs text-text-subtle border border-dashed border-border rounded">
                Drop a field here
              </div>
            )}

            {section.fields.map((field, fieldIndex) => (
              <div key={field.id}>
                <div
                  draggable
                  onDragStart={(e) => handleFieldDragStart(e, section.id, fieldIndex)}
                  onDragOver={(e) => handleFieldDragOver(e, fieldIndex)}
                  onDrop={(e) => handleFieldDrop(e, section.id, fieldIndex)}
                  onClick={() => setSelectedField(
                    isSelectedField(section.id, field.id) ? null : { sectionId: section.id, fieldId: field.id }
                  )}
                  className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer select-none transition-colors ${
                    isSelectedField(section.id, field.id)
                      ? 'border-primary bg-primary-light'
                      : dragOverFieldIndex === fieldIndex && dragFieldInfo?.sectionId === section.id
                      ? 'border-primary/50 bg-primary-light/50'
                      : 'border-border hover:bg-surface-raised'
                  } ${dragFieldInfo?.sectionId === section.id && dragFieldInfo?.fieldIndex === fieldIndex ? 'opacity-40' : ''}`}
                >
                  <span className="text-text-subtle cursor-grab text-base leading-none">⠿</span>
                  <span className="text-sm">{FIELD_TYPE_ICONS[field.type] ?? '📋'}</span>
                  <span className="flex-1 text-sm font-medium text-text">{field.label}</span>
                  {field.required && <span className="text-xs text-red-500">*</span>}
                  <span className="text-xs text-text-subtle">{field.type}</span>
                </div>

                {/* Inline editor */}
                {isSelectedField(section.id, field.id) && (
                  <FieldEditor
                    field={field}
                    onChange={(updates) => onUpdateField(section.id, field.id, updates)}
                    onDelete={() => {
                      onDeleteField(section.id, field.id)
                      setSelectedField(null)
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={onAddSection}
        className="w-full py-3 border-2 border-dashed border-border rounded-lg text-sm text-text-muted hover:border-primary hover:text-primary transition-colors"
      >
        + Add section
      </button>
    </div>
  )
}
