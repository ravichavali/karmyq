import { FormEvent, useState } from 'react';
import type { InventoryItem, InventoryItemInput } from '@/lib/api';

// BorrowRequestForm / BorrowMatcher vocabularies, kept local to the app (ADR-099).
const categories = [
  'tools',
  'electronics',
  'kitchen',
  'books',
  'sports',
  'camping',
  'party',
  'other',
];
const conditions = ['fair', 'good', 'like_new', 'new'];
const label = (value: string) => value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export default function InventoryItemForm({
  item,
  onSave,
  onCancel,
}: {
  item?: InventoryItem;
  onSave: (input: InventoryItemInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [category, setCategory] = useState(item?.category ?? 'other');
  const [condition, setCondition] = useState(item?.condition ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        category,
        condition: condition || null,
      });
    } catch {
      setError('Could not save this item. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <h2 className="text-lg font-semibold">{item ? 'Edit item' : 'Add an item'}</h2>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      <label className="block">
        Name
        <input
          className="input w-full"
          value={name}
          maxLength={120}
          required
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block">
        Description
        <textarea
          className="input w-full"
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label>
          Category
          <select
            className="input w-full"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((v) => (
              <option key={v} value={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Condition
          <select
            className="input w-full"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            <option value="">Not specified</option>
            {conditions.map((v) => (
              <option key={v} value={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-3">
        <button className="btn-primary" disabled={busy || !name.trim()} type="submit">
          {busy ? 'Saving…' : 'Save item'}
        </button>
        <button className="btn-secondary" disabled={busy} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
