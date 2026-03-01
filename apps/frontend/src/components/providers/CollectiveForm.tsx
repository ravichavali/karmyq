import React, { useState } from 'react';
import { PROVIDER_SERVICE_TYPES } from '@karmyq/shared/schemas/providers';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  tradesperson: 'Home Repair',
  tutor: 'Tutoring',
  other: 'Other',
};

interface CollectiveFormData {
  name: string;
  description?: string;
  service_types: string[];
  location_notes?: string;
}

interface CollectiveFormProps {
  initial?: Partial<CollectiveFormData>;
  onSubmit: (data: CollectiveFormData) => Promise<void>;
  submitLabel?: string;
}

export default function CollectiveForm({ initial, onSubmit, submitLabel = 'Create Collective' }: CollectiveFormProps) {
  const [form, setForm] = useState<CollectiveFormData>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    service_types: initial?.service_types ?? [],
    location_notes: initial?.location_notes ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleServiceType(type: string) {
    setForm(f => ({
      ...f,
      service_types: f.service_types.includes(type)
        ? f.service_types.filter(t => t !== type)
        : [...f.service_types, type],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.service_types.length === 0) { setError('Select at least one service type'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        ...form,
        description: form.description || undefined,
        location_notes: form.location_notes || undefined,
      });
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-text mb-1">Collective name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Northside Rickshaw Stand"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={3}
          placeholder="What does this collective offer? Who are you?"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">Service types <span className="text-red-500">*</span></label>
        <div className="flex gap-2 flex-wrap">
          {PROVIDER_SERVICE_TYPES.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => toggleServiceType(type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                form.service_types.includes(type)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-text-muted border-border hover:border-primary'
              }`}
            >
              {SERVICE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-subtle mt-1">Select all that apply</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">Service area / location notes</label>
        <input
          type="text"
          value={form.location_notes}
          onChange={e => setForm(f => ({ ...f, location_notes: e.target.value }))}
          placeholder="e.g. Serves the north and east neighborhoods"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
      >
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
