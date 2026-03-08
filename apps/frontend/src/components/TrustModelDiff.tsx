import { useState } from 'react'
import { CommunityConfig } from '@/types/community-config'
import { diffConfigs, formatConfigValue, ConfigDiffEntry } from '@/lib/trust-model'

interface TrustModelDiffProps {
  current: CommunityConfig
  proposed: Partial<CommunityConfig>
  onApplyAll: () => void
  onApplySelective: (fields: Array<keyof CommunityConfig>) => void
  onDiscard: () => void
}

export default function TrustModelDiff({
  current,
  proposed,
  onApplyAll,
  onApplySelective,
  onDiscard,
}: TrustModelDiffProps) {
  const diffs: ConfigDiffEntry[] = diffConfigs(current, proposed)

  const [checked, setChecked] = useState<Set<keyof CommunityConfig>>(
    new Set(diffs.map((d) => d.field))
  )

  if (diffs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-6 text-center space-y-3">
        <p className="text-lg font-semibold text-text">Your config already matches this trust model</p>
        <p className="text-sm text-text-muted">No changes would be made.</p>
        <button
          onClick={onDiscard}
          className="px-4 py-2 text-sm bg-gray-200 text-text-muted rounded hover:bg-gray-300"
        >
          Close
        </button>
      </div>
    )
  }

  function toggleField(field: keyof CommunityConfig) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(field)) {
        next.delete(field)
      } else {
        next.add(field)
      }
      return next
    })
  }

  function handleApplySelected() {
    onApplySelective(Array.from(checked))
  }

  const allChecked = checked.size === diffs.length
  const someChecked = checked.size > 0

  return (
    <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-surface">
        <h3 className="font-semibold text-text">Proposed Changes</h3>
        <p className="text-sm text-text-muted mt-0.5">
          {diffs.length} field{diffs.length !== 1 ? 's' : ''} would change. Review and choose what to apply.
        </p>
      </div>

      {/* Diff table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border text-text-muted text-xs uppercase tracking-wide">
              <th className="pl-6 pr-3 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() =>
                    setChecked(
                      allChecked ? new Set() : new Set(diffs.map((d) => d.field))
                    )
                  }
                  aria-label="Select all"
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3 text-left">Field</th>
              <th className="px-3 py-3 text-left">Current</th>
              <th className="px-3 py-3 text-left">Proposed</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((entry, i) => (
              <tr
                key={entry.field}
                className={[
                  'border-b border-border last:border-0',
                  i % 2 === 0 ? 'bg-surface-raised' : 'bg-surface',
                  checked.has(entry.field) ? '' : 'opacity-50',
                ].join(' ')}
              >
                <td className="pl-6 pr-3 py-3">
                  <input
                    type="checkbox"
                    checked={checked.has(entry.field)}
                    onChange={() => toggleField(entry.field)}
                    aria-label={`Select ${entry.label}`}
                    className="rounded"
                  />
                </td>
                <td className="px-3 py-3 font-medium text-text">{entry.label}</td>
                <td className="px-3 py-3 text-text-muted">
                  {formatConfigValue(entry.field, entry.currentValue)}
                </td>
                <td className="px-3 py-3 font-semibold text-primary">
                  {formatConfigValue(entry.field, entry.proposedValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-border bg-surface flex flex-wrap gap-3 items-center">
        <button
          onClick={onApplyAll}
          className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-dark font-medium"
        >
          Apply All Changes
        </button>
        <button
          onClick={handleApplySelected}
          disabled={!someChecked}
          className="px-4 py-2 text-sm bg-surface-raised border border-border text-text rounded hover:bg-surface disabled:opacity-40 font-medium"
        >
          Apply Selected ({checked.size})
        </button>
        <button
          onClick={onDiscard}
          className="px-4 py-2 text-sm text-text-muted hover:text-text transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
