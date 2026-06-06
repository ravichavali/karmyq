import UnifiedFeed from '@/components/Feed/UnifiedFeed'
import type { Community } from '@/hooks/useCommunityData'

interface Props {
  community: Community
  communityId: string
}

/**
 * Sprint 89 / ADR-068 — the warm member feed, now the Community Home surface for EVERY role.
 *
 * Previously this tab also carried the admin steward-request manager (and was admin-gated, so
 * members never reached the warm feed at all — the headline bug). That admin block now lives in
 * `StewardRequestsAdmin` under the Stewardship tab; BrowseTab is the canonical unified feed +
 * community texture that everyone lands on. The in-feed activity card is suppressed here because
 * the hero-level CommunityPulse already renders that weekly summary (`suppressActivity`).
 */
export default function BrowseTab({ community, communityId }: Props) {
  return (
    <section className="kq-page-header">
      <p className="kq-eyebrow">Community home</p>
      <h3 className="kq-headline">Ways neighbours can help here</h3>
      <p className="kq-lede">A calm queue of open asks, led by the relationships that make them feel close.</p>
      <UnifiedFeed
        view="community"
        communityId={communityId}
        communityType={community?.community_type === 'group' ? 'group' : 'mutual_aid'}
        suppressActivity
      />
    </section>
  )
}
