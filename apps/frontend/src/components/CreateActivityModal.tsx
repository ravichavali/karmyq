import React, { useState } from 'react'
import { communityService } from '@/lib/api'

interface CreateActivityModalProps {
  communityId: string
  onCreated: () => void
  onClose: () => void
}

export default function CreateActivityModal({ communityId, onCreated, onClose }: CreateActivityModalProps) {
  const [form, setForm] = useState({
    title: '',
    activity_type: '',
    scheduled_at: '',
    duration_minutes: '',
    location: '',
    max_participants: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        activity_type: form.activity_type,
        scheduled_at: form.scheduled_at,
      }
      if (form.duration_minutes) payload.duration_minutes = Number(form.duration_minutes)
      if (form.location) payload.location = form.location
      if (form.max_participants) payload.max_participants = Number(form.max_participants)

      await communityService.createActivity(communityId, payload)
      onCreated()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create activity'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-raised rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text">Create Activity</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text text-xl leading-none">&times;</button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Title *</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded border border-border bg-surface text-text text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Activity Type *</label>
            <select
              name="activity_type"
              value={form.activity_type}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded border border-border bg-surface text-text text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="">Select type…</option>
              <option value="pickup_game">Pickup Game</option>
              <option value="group_run">Group Run</option>
              <option value="workout">Workout</option>
              <option value="social">Social</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Date &amp; Time *</label>
            <input
              type="datetime-local"
              name="scheduled_at"
              value={form.scheduled_at}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded border border-border bg-surface text-text text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Duration (minutes)</label>
            <input
              type="number"
              name="duration_minutes"
              value={form.duration_minutes}
              onChange={handleChange}
              min="1"
              placeholder="e.g. 90"
              className="w-full px-3 py-2 rounded border border-border bg-surface text-text text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Location</label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="e.g. Riverside Park"
              className="w-full px-3 py-2 rounded border border-border bg-surface text-text text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Max Participants</label>
            <input
              type="number"
              name="max_participants"
              value={form.max_participants}
              onChange={handleChange}
              min="1"
              placeholder="Leave blank for no cap"
              className="w-full px-3 py-2 rounded border border-border bg-surface text-text text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded border border-border text-text hover:bg-surface disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
