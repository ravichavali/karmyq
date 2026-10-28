import { useState } from 'react'

/**
 * Shared exchange-rating prompt (BUG-005). Rendered by both the Dashboard
 * DecisionBand and the CommitmentsTab when an exchange reaches `fully_completed`,
 * so the rating UI is one source of truth across surfaces. Cards right-align it (the default); the
 * request page's completed-exchange panel left-aligns it under the partner sentence.
 */
export default function RatingPrompt({ onRate, align = 'end' }: {
  onRate: (rating: number | null) => void
  align?: 'start' | 'end'
}) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className={`flex items-center ${align === 'start' ? 'justify-start' : 'justify-end'} gap-3 mt-3`}>
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
