import { useState } from 'react'
import { submitOffer } from '@/lib/api/providerApi'
import RelationshipContextPanel from './relationships/RelationshipContextPanel'

interface SubmitOfferModalProps {
  requestId: string
  requestTitle: string
  defaultPrice: number | null
  onClose: () => void
  onSubmitted: () => void
}

export default function SubmitOfferModal({
  requestId,
  requestTitle,
  defaultPrice,
  onClose,
  onSubmitted,
}: SubmitOfferModalProps) {
  const [price, setPrice] = useState<string>(defaultPrice != null ? String(defaultPrice) : '')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const parsedPrice = price.trim() !== '' ? parseFloat(price) : null
      await submitOffer(requestId, parsedPrice, note)
      onSubmitted()
      onClose()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to submit offer. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="card p-6 max-w-md w-full mx-4 relative z-10">
        <h2 className="text-lg font-semibold text-text mb-1">Make an Offer</h2>
        <p className="text-sm text-text-muted mb-4">{requestTitle}</p>

        {/* S116/ADR-084: show the provider how they connect to this requester before submitting.
            Non-blocking — Submit never waits on it. */}
        <RelationshipContextPanel kind="request" requestId={requestId} />

        <div className="mb-4">
          <label className="block text-sm font-medium text-text mb-1">
            Price (optional)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Leave blank if free"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-text focus:outline-hidden focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-text mb-1">
            Note (optional)
          </label>
          <textarea
            rows={3}
            placeholder="Any details about your offer..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-text focus:outline-hidden focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="btn-ghost text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary text-sm"
          >
            {submitting ? 'Submitting…' : 'Submit Offer'}
          </button>
        </div>
      </div>
    </div>
  )
}
