import { useState } from 'react'

export interface FieldEditorProps {
  field: {
    id: string
    type: string
    label: string
    sectionId: string
  }
  onSave: (updates: any) => void
  onCancel: () => void
}

export default function FieldEditor({ field, onSave, onCancel }: FieldEditorProps) {
  const [label, setLabel] = useState(field.label)
  const [properties, setProperties] = useState<any>({})

  const handleSave = () => {
    onSave({
      label,
      ...properties,
    })
    onCancel()
  }

  return (
    <div className="border border-border rounded-lg bg-surface p-6">
      <h3 className="text-lg font-semibold text-text mb-4">Edit Field</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Type
          </label>
          <div className="px-4 py-3 bg-surface border border-border rounded">
            {field.type}
          </div>
        </div>

        {/* Property Editor - Simplified for now */}
        <div className="bg-surface rounded-lg p-6">
          <h4 className="text-md font-semibold text-text mb-3">Field Properties</h4>
          <div className="text-sm text-text-muted mb-4">
            Properties vary by field type. Edit the schema directly for complex changes.
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-surface border border-border rounded hover:bg-surface-raised"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSave}
            className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark font-semibold"
          >
            Save Field
          </button>
        </div>
      </div>
    </div>
  )
}
