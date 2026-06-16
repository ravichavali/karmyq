import type { OfferedAwaitingItem } from '@/types/unified-feed'

/**
 * Sprint 101 — Home preview of the open asks the member has already offered on and now awaits the
 * requester's response. Sprint 100 (G1) showed only an aggregate count; this surfaces the actual
 * asks as links to their detail pages, so an active helper can pick one up where they left off
 * instead of guessing what the count refers to.
 *
 * These are NOT decisions the member owes (the requester owes the next move), so this is a calm
 * preview band, not part of the DecisionBand. `count` is the full distinct-open-ask total; `items`
 * is the (server-capped) preview, with a trailing link to the full list in Helping.
 */
export default function OfferedAwaitingPanel({
  count,
  items,
}: {
  count: number
  items: OfferedAwaitingItem[]
}) {
  return (
    <section className="kq-card mb-3" aria-label="Asks you've offered to help on">
      <p className="text-[14.5px] text-text font-medium">
        <span aria-hidden className="mr-2">🤲</span>
        You’ve offered to help on {count} open {count === 1 ? 'ask' : 'asks'}.
      </p>
      <p className="text-sm text-muted-foreground">Waiting for the requester to respond.</p>

      {items.length > 0 && (
        <ul className="mt-2 divide-y divide-border">
          {items.map((item) => (
            <li key={item.match_id}>
              <a
                href={`/requests/${item.request_id}`}
                className="flex items-center justify-between gap-3 py-2 hover:bg-surface-raised transition-colors rounded"
              >
                <span className="text-sm text-text truncate">{item.title}</span>
                {item.community_name && (
                  <span className="text-xs text-muted-foreground shrink-0">{item.community_name}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}

      <a href="/dashboard?tab=helping" className="inline-block mt-2 text-sm font-medium text-primary">
        View all in Helping →
      </a>
    </section>
  )
}
