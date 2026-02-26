import React from 'react';

const TRUST_DISTANCE_OPTIONS = [
  { label: 'Direct', value: '1' },
  { label: '2nd degree', value: '2' },
  { label: 'Community', value: '3' },
  { label: 'All', value: '' },
];

interface FeedFilterPanelProps {
  filterTrustDistance: string;
  filterRequestType: string;
  availableTypes: { value: string; label: string }[];
  onTrustDistanceChange: (value: string) => void;
  onRequestTypeChange: (value: string) => void;
  onClear: () => void;
}

export default function FeedFilterPanel({
  filterTrustDistance,
  filterRequestType,
  availableTypes,
  onTrustDistanceChange,
  onRequestTypeChange,
  onClear,
}: FeedFilterPanelProps) {
  return (
    <div
      className="absolute right-0 top-8 z-10 bg-surface-raised border border-border rounded-xl shadow-lg p-4 w-64"
      data-testid="filter-panel"
    >
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Filter Feed</p>

      <div className="mb-3">
        <p className="text-xs text-text-subtle mb-1.5">Trust distance</p>
        <div className="flex flex-wrap gap-1.5">
          {TRUST_DISTANCE_OPTIONS.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => onTrustDistanceChange(value)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                filterTrustDistance === value
                  ? 'bg-primary text-white border-primary'
                  : 'text-text-muted border-border hover:bg-border-light'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs text-text-subtle mb-1.5">Request type</p>
        <div className="flex flex-wrap gap-1.5">
          {[{ value: '', label: 'All' }, ...availableTypes].map(({ value, label }) => (
            <button
              key={value || 'all'}
              onClick={() => onRequestTypeChange(value)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                filterRequestType === value
                  ? 'bg-primary text-white border-primary'
                  : 'text-text-muted border-border hover:bg-border-light'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onClear}
        className="text-xs text-text-subtle hover:text-text-muted"
      >
        Clear filters
      </button>
    </div>
  );
}
