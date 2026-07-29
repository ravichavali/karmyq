import { useState } from 'react'

export interface SectionEditorProps {
  section: {
    id: string
    title: string
    description?: string
    fields: any[]
  }
  onSave: (updates: any) => void
  onCancel: () => void
}

export default function SectionEditor({ section, onSave, onCancel }: SectionEditorProps) {
  const [title, setTitle] = useState(section.title)
  const [description, setDescription] = useState(section.description || '')

  const handleSave = () => {
    onSave({
      title,
      description,
    })
    onCancel()
  }

  return (
    <div className="border border-border rounded-lg bg-surface p-6">
      <h3 className="text-lg font-semibold text-text mb-4">Edit Section</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border border-border rounded focus:outline-hidden focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-border rounded focus:outline-hidden focus:ring-2 focus:ring-primary resize-none"
            placeholder="Describe what information this section should collect..."
          />
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
            Save Section
          </button>
        </div>
      </div>
    </div>
  )
}
