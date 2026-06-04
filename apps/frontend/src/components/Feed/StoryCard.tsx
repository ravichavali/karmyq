import type { StoryData } from '@/types/feed-items'

/**
 * Community texture (Sprint 86 / ADR-066) — a short narrative beat (a first exchange, a karma
 * milestone) that gives the Community Feed warmth. Ranks below the activity summary. Presentational.
 */

const STORY_ICONS: Record<StoryData['type'], string> = {
  first_timer: '🌱',
  milestone: '🏆',
  pay_it_forward: '🔄',
  unexpected_match: '💡',
}

export default function StoryCard({ data }: { data: StoryData }) {
  return (
    <div className="feed-card bg-gradient-to-r from-karmyq-green-50 to-primary-light">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl" aria-hidden>{STORY_ICONS[data.type] ?? '✨'}</span>
        <h3 className="font-semibold text-text">{data.title}</h3>
      </div>
      <p className="text-sm text-text-muted">{data.description}</p>
      {data.community_name && <p className="text-xs text-text-subtle mt-1">in {data.community_name}</p>}
    </div>
  )
}
