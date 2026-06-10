import { useState } from 'react'

/**
 * Shared exchange-rating prompt (BUG-005). Rendered by both the Dashboard
 * DecisionBand and the CommitmentsTab when an exchange reaches `fully_completed`,
 * so the rating UI is one source of truth across surfaces.
 */
export default function RatingPrompt({ onRate }: { onRate: (rating: number | null) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex items-center justify-end gap-3 mt-3">
      <span className="text-xs text-text-muted">Rate this exchange:</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className="text-base leading-none text-amber-400 hover:text-amber-500 transition-colors"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onRate(star)}
          >
            {star <= hovered ? '★' : '☆'}
          </button>
        ))}
      </div>
      <button
        className="text-xs text-text-muted hover:text-text underline underline-offset-2"
        onClick={() => onRate(null)}
      >
        Skip
      </button>
    </div>
  )
}
