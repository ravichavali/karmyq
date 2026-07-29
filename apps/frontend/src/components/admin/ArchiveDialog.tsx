import { useState } from 'react'

export interface ArchiveDialogProps {
  isOpen: boolean
  schema: any
  onArchive: () => void
  onCancel: () => void
}

export default function ArchiveDialog({ isOpen, schema, onArchive, onCancel }: ArchiveDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleArchive = async () => {
    if (!schema) return

    try {
      setLoading(true)
      await onArchive()
      onCancel()
      alert('Schema archived successfully!')
    } catch (err: any) {
      console.error('Failed to archive', { error: err instanceof Error ? err.message : String(err) })
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl p-6 max-w-md">
        <h2 className="text-xl font-semibold text-text mb-4">Archive Schema?</h2>
        <p className="text-text-muted mb-6">
          This will hide the schema from users and prevent new requests.
          <br />
          <span className="text-sm text-primary">Archived schemas can be restored by rolling back to a previous version or creating a new draft.</span>
        </p>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-surface border border-border rounded hover:bg-surface-raised"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleArchive}
            disabled={loading || schema.status === 'archived'}
            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-400"
          >
            {loading ? 'Archiving...' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  )
}
