import React from 'react'

export type RequestTypeFilter = 'all' | 'generic' | 'ride' | 'service' | 'event' | 'borrow'
export type UrgencyFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low'

interface FilterChipRowProps {
  activeType: RequestTypeFilter
  activeUrgency: UrgencyFilter
  onTypeChange: (type: RequestTypeFilter) => void
  onUrgencyChange: (urgency: UrgencyFilter) => void
}

const TYPE_CHIPS: { value: RequestTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ride', label: '🚗 Rides' },
  { value: 'service', label: '🔧 Services' },
  { value: 'borrow', label: '📦 Borrow' },
  { value: 'event', label: '📅 Events' },
  { value: 'generic', label: 'General' },
]

const URGENCY_CHIPS: { value: UrgencyFilter; label: string }[] = [
  { value: 'all', label: 'Any urgency' },
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high', label: '🟠 High' },
  { value: 'medium', label: '🟡 Medium' },
]

export default function FilterChipRow({ activeType, activeUrgency, onTypeChange, onUrgencyChange }: FilterChipRowProps) {
  return (
    <div className="flex flex-col gap-2 py-3">
      {/* Type filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TYPE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => onTypeChange(chip.value)}
            className={`filter-chip ${activeType === chip.value ? 'active' : ''}`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {/* Urgency filters — only show when a specific type is selected or urgency is active */}
      {(activeUrgency !== 'all' || activeType !== 'all') && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {URGENCY_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => onUrgencyChange(chip.value)}
              className={`filter-chip ${activeUrgency === chip.value ? 'active' : ''}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
