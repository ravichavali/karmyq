import { useState } from 'react'
import MemberSkills from '@/components/skills/MemberSkills'
import RatingPrompt from '@/components/RatingPrompt'
import { submitExchangeRating } from '@/utils/completion'

export interface ViewerPartner {
  match_id: string
  user_id: string
  name: string
  completed_at: string | null
  rated_by_me: boolean
  rating_community_id: string | null
}

/**
 * Sprint 134 PR B — close out a completed exchange from the request page.
 *
 * The server lists only exchanges this viewer took part in (`viewer_partners`), newest first, and
 * MemberSkills shows only skills the server says POST /endorsements would accept. Ratings stay
 * private (ADR-036): the panel knows only whether this viewer has rated.
 */
export default function CompletedExchangePanel({ partners, viewerIsRequester }: {
  partners: ViewerPartner[]
  viewerIsRequester: boolean
}) {
  const [outcome, setOutcome] = useState<Record<string, 'saving' | 'rated' | 'skipped' | 'failed'>>({})
  // Rate per exchange; vouch once per person, on their newest entry (the list is newest first;
  // BUG-074 can leave one partner with two completed matches on the same ask).
  const isNewestFor = (p: ViewerPartner) => partners.find(q => q.user_id === p.user_id) === p

  const mark = (matchId: string, state: 'saving' | 'rated' | 'skipped' | 'failed') =>
    setOutcome(prev => ({ ...prev, [matchId]: state }))
  // The prompt unmounts while saving, so a second click cannot send a second rating. Thanks only
  // once the server has the rating; a failed write brings the prompt back to retry.
  const rate = async (p: ViewerPartner, rating: number | null) => {
    if (rating === null) {
      mark(p.match_id, 'skipped')
      return
    }
    mark(p.match_id, 'saving')
    const onRecord = await submitExchangeRating({ matchId: p.match_id, toUserId: p.user_id, communityId: p.rating_community_id, rating })
    mark(p.match_id, onRecord ? 'rated' : 'failed')
  }

  return (
    <section aria-label="Your completed exchange" className="mt-4 space-y-4 border-t border-border pt-4">
      {partners.map(p => (
        // space-y, not wrapper margins: MemberSkills renders nothing when no skill is vouchable.
        <div key={p.match_id} className="space-y-3">
          <p className="text-sm text-text">
            {viewerIsRequester ? `${p.name} helped with this ask.` : `You helped ${p.name} with this ask.`}
          </p>
          {!p.rated_by_me && p.rating_community_id && (!outcome[p.match_id] || outcome[p.match_id] === 'failed') && (
            <RatingPrompt align="start" onRate={(rating) => rate(p, rating)} />
          )}
          {outcome[p.match_id] === 'failed' && (
            <p className="text-xs text-error">Your rating didn&apos;t save. Try again.</p>
          )}
          {outcome[p.match_id] === 'rated' && (
            <p className="text-xs text-text-muted">Thanks — ratings stay private.</p>
          )}
          {isNewestFor(p) && (
            <MemberSkills userId={p.user_id} endorsableOnly heading={`Vouch for a skill you saw ${p.name} use:`} />
          )}
        </div>
      ))}
    </section>
  )
}
