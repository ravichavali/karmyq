import { useState } from 'react'

export interface PublishDialogProps {
  isOpen: boolean
  schema: any
  onPublish: () => void
  onCancel: () => void
}

export default function PublishDialog({ isOpen, schema, onPublish, onCancel }: PublishDialogProps) {
  const [loading, setLoading] = useState(false)

  const handlePublish = async () => {
    if (!schema) return

    try {
      setLoading(true)
      await onPublish()
      onCancel()
      alert('Schema published successfully!')
    } catch (err: any) {
      console.error('Failed to publish:', err)
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl p-6 max-w-md">
        <h2 className="text-xl font-semibold text-text mb-4">Publish Schema?</h2>
        <p className="text-text-muted mb-6">
          This will make the schema live and available to all users.
        </p>

        {schema.status === 'published' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-900 mb-4">
            ⚠️ This schema is already published.
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-900 mb-4">
          ℹ️ Published schemas cannot be edited. Create a new version to make changes.
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-surface border border-border rounded hover:bg-surface-raised"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={loading || schema.status === 'published'}
            className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-primary-medium"
          >
            {loading ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}
