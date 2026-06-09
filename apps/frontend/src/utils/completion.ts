import { reputationService } from '@/lib/api'

/**
 * BUG-005 — one source of truth for the completion → rating transition.
 *
 * The backend `PUT /matches/:id/complete` returns `{ fully_completed, waiting_for }`
 * (two-phase completion). Both the Dashboard DecisionBand and the CommitmentsTab
 * decide whether to unlock the rating prompt from the SAME signal: rating fires only
 * on the transition to `fully_completed`, never on a one-sided done.
 */

export interface CompletionResult {
  fullyCompleted: boolean
  waitingFor: string | null
}

/**
 * Read a `completeMatch` response into a normalized completion result. Tolerates
 * both the unwrapped envelope (`res.data = { fully_completed }`) and a raw
 * `{ data: { ... } }` shape.
 */
export function extractCompletion(res: unknown): CompletionResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = res as any
  const data = r?.data?.data ?? r?.data ?? {}
  return {
    fullyCompleted: data.fully_completed === true,
    waitingFor: data.waiting_for ?? null,
  }
}

/**
 * Submit an exchange rating (best-effort). No-op when the rating is skipped (null)
 * or the counterparty/community ids needed to attribute it are missing.
 */
export async function submitExchangeRating(params: {
  matchId: string
  toUserId?: string | null
  communityId?: string | null
  rating: number | null
}): Promise<void> {
  const { matchId, toUserId, communityId, rating } = params
  if (rating === null || !toUserId || !communityId) return
  try {
    await reputationService.submitFeedback({
      match_id: matchId,
      to_user_id: toUserId,
      community_id: communityId,
      rating,
    })
  } catch {
    // Feedback is best-effort — never block the UI on a rating write.
  }
}
