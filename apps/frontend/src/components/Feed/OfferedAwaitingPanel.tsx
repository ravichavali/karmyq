import type { OfferedAwaitingItem } from '@/types/unified-feed'

/**
 * Sprint 101 — Home preview of the open asks the member has already offered on and now awaits the
 * requester's response. Sprint 100 (G1) showed only an aggregate count; this surfaces the actual
 * asks as links to their detail pages, so an active helper can pick one up where they left off
 * instead of guessing what the count refers to.
 *
 * These are NOT decisions the member owes (the requester owes the next move), so this is a calm
 * preview band, not part of the DecisionBand. `count` is the full distinct-open-ask total; `items`
 * is the (server-capped) preview. Sprint 108: each previewed ask carries an explicit "Open ask"
 * affordance so an active helper can act on one in place, not only "View all in Helping".
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
            <li key={item.match_id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm text-text truncate">{item.title}</span>
                {item.community_name && (
                  <span className="block text-xs text-muted-foreground">{item.community_name}</span>
                )}
              </span>
              <a
                href={`/requests/${item.request_id}`}
                className="shrink-0 text-sm font-medium text-primary hover:underline"
                aria-label={`Open ask: ${item.title}`}
              >
                Open ask →
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
