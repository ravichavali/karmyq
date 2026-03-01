import React, { useState } from 'react';
import { PROVIDER_SERVICE_TYPES } from '@karmyq/shared/schemas/providers';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  ride: 'Rides',
  tradesperson: 'Home Repair',
  tutor: 'Tutoring',
  other: 'Other',
};

interface RideDetails {
  vehicle_type?: string;
  max_passengers: number;
  typical_routes?: string;
  advance_booking_required: boolean;
}

interface ProviderFormData {
  service_type: string;
  display_name: string;
  bio?: string;
  pricing_notes?: string;
  location_notes?: string;
  is_active: boolean;
  ride_details?: RideDetails;
}

interface ProviderFormProps {
  initial?: Partial<ProviderFormData>;
  onSubmit: (data: ProviderFormData) => Promise<void>;
  submitLabel?: string;
}

export default function ProviderForm({ initial, onSubmit, submitLabel = 'Create Profile' }: ProviderFormProps) {
  const [form, setForm] = useState<ProviderFormData>({
    service_type: initial?.service_type ?? 'other',
    display_name: initial?.display_name ?? '',
    bio: initial?.bio ?? '',
    pricing_notes: initial?.pricing_notes ?? '',
    location_notes: initial?.location_notes ?? '',
    is_active: initial?.is_active ?? true,
    ride_details: initial?.ride_details ?? {
      vehicle_type: '',
      max_passengers: 1,
      typical_routes: '',
      advance_booking_required: false,
    },
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function update(key: keyof ProviderFormData, value: any) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function updateRide(key: keyof RideDetails, value: any) {
    setForm(f => ({ ...f, ride_details: { ...f.ride_details!, [key]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.display_name.trim()) {
      setError('Display name is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload: ProviderFormData = {
        ...form,
        bio: form.bio || undefined,
        pricing_notes: form.pricing_notes || undefined,
        location_notes: form.location_notes || undefined,
        ride_details: form.service_type === 'ride' ? form.ride_details : undefined,
      };
      await onSubmit(payload);
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
        <label className="block text-sm font-medium text-text mb-1">Service type</label>
        <div className="flex gap-2 flex-wrap">
          {PROVIDER_SERVICE_TYPES.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => update('service_type', type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                form.service_type === type
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-text-muted border-border hover:border-primary'
              }`}
            >
              {SERVICE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">Display name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={form.display_name}
          onChange={e => update('display_name', e.target.value)}
          placeholder="How you want to appear in the directory"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">Bio</label>
        <textarea
          value={form.bio}
          onChange={e => update('bio', e.target.value)}
          rows={3}
          placeholder="Describe what you offer and any relevant experience"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">Pricing notes</label>
        <input
          type="text"
          value={form.pricing_notes}
          onChange={e => update('pricing_notes', e.target.value)}
          placeholder="e.g. ~500/hr, negotiable"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-xs text-text-subtle mt-1">Advisory only — Karmyq never processes payment</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">Location / service area</label>
        <input
          type="text"
          value={form.location_notes}
          onChange={e => update('location_notes', e.target.value)}
          placeholder="e.g. North side of the city, within 5km"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {form.service_type === 'ride' && (
        <div className="bg-surface rounded-lg border border-border p-4 space-y-4">
          <p className="text-sm font-medium text-text">Ride details</p>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Vehicle type</label>
            <input
              type="text"
              value={form.ride_details?.vehicle_type ?? ''}
              onChange={e => updateRide('vehicle_type', e.target.value)}
              placeholder="e.g. Auto-rickshaw, Car, Bicycle"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Max passengers</label>
            <input
              type="number"
              min={1}
              max={20}
              value={form.ride_details?.max_passengers ?? 1}
              onChange={e => updateRide('max_passengers', parseInt(e.target.value, 10))}
              className="w-24 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Typical routes</label>
            <textarea
              value={form.ride_details?.typical_routes ?? ''}
              onChange={e => updateRide('typical_routes', e.target.value)}
              rows={2}
              placeholder="e.g. Station to market, airport runs"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="advance_booking"
              checked={form.ride_details?.advance_booking_required ?? false}
              onChange={e => updateRide('advance_booking_required', e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="advance_booking" className="text-sm text-text">Advance booking required</label>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={form.is_active}
          onChange={e => update('is_active', e.target.checked)}
          className="rounded border-border"
        />
        <label htmlFor="is_active" className="text-sm text-text">Profile is active (visible in directory)</label>
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
