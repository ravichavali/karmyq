export type DiscoveryMode = 'geography' | 'interests'

const STORAGE_KEY = 'community_discovery_mode'

interface DiscoveryToggleProps {
  mode: DiscoveryMode
  onChange: (mode: DiscoveryMode) => void
}

export default function DiscoveryToggle({ mode, onChange }: DiscoveryToggleProps) {
  // Persist only a user's choice. Sprint 130 (BUG-043): persisting on mount wrote the initial
  // 'geography' before the page read storage, so a saved mode was lost on every load.
  const choose = (next: DiscoveryMode) => {
    localStorage.setItem(STORAGE_KEY, next)
    onChange(next)
  }

  return (
    <div className="flex items-center gap-2 p-1 bg-surface-raised border border-border rounded-full w-fit">
      <button
        type="button"
        aria-pressed={mode === 'geography'}
        onClick={() => choose('geography')}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
          mode === 'geography'
            ? 'bg-primary text-white'
            : 'border border-border text-text-muted hover:text-text hover:border-border'
        }`}
      >
        📍 Near Me
      </button>
      <button
        type="button"
        aria-pressed={mode === 'interests'}
        onClick={() => choose('interests')}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
          mode === 'interests'
            ? 'bg-primary text-white'
            : 'border border-border text-text-muted hover:text-text hover:border-border'
        }`}
      >
        🏷️ By Interest
      </button>
    </div>
  )
}

export function readDiscoveryMode(): DiscoveryMode {
  if (typeof window === 'undefined') return 'geography'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'geography' || stored === 'interests') return stored
  return 'geography'
}
