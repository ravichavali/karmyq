export type BrowseMode = 'community' | 'provider' | 'both'

interface BrowseModeControlProps {
  browseMode: BrowseMode
  onChange: (mode: BrowseMode) => void
}

export default function BrowseModeControl({ browseMode, onChange }: BrowseModeControlProps) {
  return (
    <div className="flex gap-1 mb-3 mt-1">
      {(['community', 'provider', 'both'] as BrowseMode[]).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`flex-1 py-1.5 text-sm font-medium rounded-lg border transition-colors capitalize ${
            browseMode === mode
              ? 'bg-primary text-white border-primary'
              : 'bg-surface text-text-muted border-border hover:border-primary hover:text-text'
          }`}
        >
          {mode === 'community' ? 'Community' : mode === 'provider' ? 'Provider' : 'Both'}
        </button>
      ))}
    </div>
  )
}
