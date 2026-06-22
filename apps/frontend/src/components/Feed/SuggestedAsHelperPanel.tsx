import type { OfferedAwaitingItem } from '@/types/unified-feed'

/**
 * Sprint 108 — Home preview of the open asks where an admin/matchmaker suggested THIS member as a
 * helper and the member owes the accept/decline. Modeled on OfferedAwaitingPanel: a calm,
 * non-actionable preview band that names the actual asks and links to Helping, where the actionable
 * DecisionBand lives. BUG-015 keeps decisions off Home, so this band carries NO inline accept/decline.
 *
 * `count` is the full distinct-open-ask total; `items` is the (server-capped) preview.
 */
export default function SuggestedAsHelperPanel({
  count,
  items,
}: {
  count: number
  items: OfferedAwaitingItem[]
}) {
  return (
    <section className="kq-card mb-3" aria-label="Asks where you were suggested as a helper">
      <p className="text-[14.5px] text-text font-medium">
        <span aria-hidden className="mr-2">🙌</span>
        {count === 1 ? 'A neighbour' : `${count} neighbours`} suggested you as a helper.
      </p>
      <p className="text-sm text-muted-foreground">Accept or decline in Helping.</p>

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
        Respond in Helping →
      </a>
    </section>
  )
}
