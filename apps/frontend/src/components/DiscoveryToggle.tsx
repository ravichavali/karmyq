import { useEffect } from 'react'

export type DiscoveryMode = 'geography' | 'interests'

const STORAGE_KEY = 'community_discovery_mode'

interface DiscoveryToggleProps {
  mode: DiscoveryMode
  onChange: (mode: DiscoveryMode) => void
}

export default function DiscoveryToggle({ mode, onChange }: DiscoveryToggleProps) {
  // Persist mode to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode)
    }
  }, [mode])

  return (
    <div className="flex items-center gap-2 p-1 bg-surface-raised border border-border rounded-full w-fit">
      <button
        type="button"
        onClick={() => onChange('geography')}
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
        onClick={() => onChange('interests')}
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
