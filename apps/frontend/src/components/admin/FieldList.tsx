import { useState } from 'react'

export interface FieldListProps {
  sectionId: string
  fields: any[]
  onEdit: (fieldId: string) => void
  onDelete: (fieldId: string) => void
  onReorder: (fieldIds: string[]) => void
}

export default function FieldList({ sectionId, fields, onEdit, onDelete, onReorder }: FieldListProps) {
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null)

  const handleDragStart = (fieldId: string) => {
    setDraggedFieldId(fieldId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (!draggedFieldId) return

    // Find drop target
    const targetElement = e.target as HTMLElement
    const dropIndex = Array.from(targetElement.parentElement?.children || []).findIndex(
      child => child !== e.currentTarget
    )

    if (dropIndex !== undefined && draggedFieldId) {
      onReorder([draggedFieldId, fields[dropIndex].id])
      setDraggedFieldId(null)
    }
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div
          key={field.id}
          draggable={true}
          onDragStart={() => handleDragStart(field.id)}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-3 p-3 bg-surface rounded border transition-all ${
            draggedFieldId === field.id ? 'opacity-50 cursor-grabbing' : 'cursor-grab hover:shadow-md'
          }`}
        >
          {/* Drag Handle */}
          <div className="cursor-grab p-2 text-text-subtle hover:text-text">
            ≋
          </div>

          <div className="flex-1">
            <div className="flex-1">
              <span className="text-sm text-text-muted">{field.label}</span>
              <span className="text-xs text-text-subtle">({field.type})</span>
            </div>
          </div>

          <div className="flex-1 gap-2 ml-auto">
            <button
              onClick={() => onEdit(field.id)}
              className="px-3 py-1 bg-surface border border-border rounded hover:bg-surface-raised text-sm"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(field.id)}
              className="px-3 py-1 bg-red-100 text-red-700 border border-red-200 rounded hover:bg-red-200 text-sm"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
