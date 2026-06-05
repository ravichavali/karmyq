import Link from 'next/link'
import type { ActivityData } from '@/types/unified-feed'

/**
 * Community texture (Sprint 86 / ADR-066) — the community "pulse" summary that ranks below the
 * requests you can fill in the Community Feed view: exchanges completed this week, recent helpers,
 * new members, and a pointer to the open requests. Presentational only; the server owns ordering.
 */
export default function ActivityCard({ data }: { data: ActivityData }) {
  return (
    <div className="feed-card kq-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-text truncate">{data.community_name}</h3>
          <p className="text-xs text-text-subtle">This week in your community</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center text-sm">
          <svg className="w-4 h-4 text-success mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-text-muted">
            <strong>{data.exchanges_completed_week}</strong> exchange{data.exchanges_completed_week !== 1 ? 's' : ''} completed
          </span>
        </div>

        {data.recent_helpers && data.recent_helpers.length > 0 && (
          <div className="flex items-start text-sm">
            <svg className="w-4 h-4 text-primary mr-2 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            <span className="text-text-muted">
              Top helpers: {data.recent_helpers.map((h) => `${h.name} (${h.help_count})`).join(', ')}
            </span>
          </div>
        )}

        {data.new_members_count > 0 && (
          <div className="flex items-center text-sm">
            <svg className="w-4 h-4 text-accent mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
            <span className="text-text-muted">
              <strong>{data.new_members_count}</strong> new member{data.new_members_count !== 1 ? 's' : ''} this week
            </span>
          </div>
        )}
      </div>

      {data.open_requests_count > 0 && (
        <div className="mt-3 pt-3 border-t border-border-light">
          <Link
            href={`/communities/${data.community_id}`}
            className="inline-flex items-center text-sm font-medium text-primary hover:text-primary-dark"
          >
            {data.open_requests_count} open request{data.open_requests_count !== 1 ? 's' : ''} need help
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  )
}
