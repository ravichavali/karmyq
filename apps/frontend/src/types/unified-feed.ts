/**
 * Unified Feed model (Sprint 85 / ADR-066).
 *
 * One feed-item union rendered in two views, ordered by server-computed action altitude.
 * S85 populates the `request` and `decision` kinds for Dashboard Home; S86 populates the
 * `activity` and `story` texture kinds for the Community Feed view.
 *
 * This module is the canonical home for the reconciled feed vocabulary — the single
 * urgency scale, the member-facing status token, and the `match_score` normalizer — so
 * the one canonical RequestCard never has to re-derive them.
 */

import type { CommunityActivityData, OpenRequestData, StoryData } from './feed-items'
import type { RequestType, RequestPayload } from './request-payloads'

// ── Urgency: one scale (urgent is the top tier; 'critical'/'normal' retired in S85) ──
export const URGENCY_LEVELS = ['urgent', 'high', 'medium', 'low'] as const
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number]

// ── Status: one member-facing vocabulary ──
// The help_requests lifecycle is open → dibs_pending → matched → completed (+cancelled).
// 'proposed' is the DERIVED awaiting-acceptance display token (a request whose offer
// awaits the requester's acceptance) — it reconciles the matches/offers/dibs 'pending'
// token into the card's vocabulary (direction-doc Principle 6). It is never stored on
// the help_requests row; the curated handler derives it from request + match state.
export const REQUEST_STATUS_TOKENS = [
  'open',
  'proposed',
  'matched',
  'dibs_pending',
  'completed',
  'cancelled',
] as const
export type RequestStatusToken = (typeof REQUEST_STATUS_TOKENS)[number]

/**
 * Normalize a `match_score` to one 0–100 integer scale.
 * Accepts either a 0–1 fraction (scaled up) or a value already on 0–100. Absent/invalid
 * scores return `null` (never 0 — 0 is a legitimate score), so the card can distinguish
 * "no score" from "scored zero".
 */
export function normalizeMatchScore(raw: number | null | undefined): number | null {
  if (raw == null || Number.isNaN(raw)) return null
  const scaled = raw > 0 && raw <= 1 ? raw * 100 : raw
  return Math.round(Math.min(100, Math.max(0, scaled)))
}

/**
 * Normalize a raw status into the canonical member-facing token. The awaiting-acceptance
 * token 'pending' (used by the matches/offers/dibs lifecycle) maps to 'proposed'; the
 * canonical lifecycle tokens pass through; anything unknown falls back to 'open'.
 */
export function normalizeStatusToken(raw: string | null | undefined): RequestStatusToken {
  if (raw === 'pending') return 'proposed'
  if (raw != null && (REQUEST_STATUS_TOKENS as readonly string[]).includes(raw)) {
    return raw as RequestStatusToken
  }
  return 'open'
}

/**
 * The fine payload subtype the card's `RequestPayloadRenderer` switches on — distinct from
 * `request_type` (the coarse 5-value `request_type_enum` filter dimension). Sourced from the
 * DB `category` column via the request-service `categoryToPayloadType()` adapter (ADR-067).
 * It is structurally the renderer's `RequestType` union, aliased here so there is one source
 * of truth for the payload-subtype vocabulary the renderer accepts.
 */
export type PayloadType = RequestType

/**
 * The canonical request-card payload. Reuses the existing `OpenRequestData` shape (whose
 * `urgency` is already the canonical scale) and tightens `status` to the member-facing
 * token, then adds the reconciled card fields: a normalized match score + explainable
 * reason, the trust-path signal, and the fine payload subtype that drives payload rendering.
 */
export interface RequestCardData extends Omit<OpenRequestData, 'status'> {
  status: RequestStatusToken
  // Fine payload subtype (ADR-067): from DB `category`, drives RequestPayloadRenderer. Distinct
  // from `request_type` (the coarse enum filter). Undefined when the category has no payload mapping.
  payload_type?: PayloadType
  // Explainable match signal (Principle 5): one 0–100 score + a human-readable reason.
  match_score: number | null
  match_reason: string
  // Trust signal (Principle 4): degree of separation, never a bare opaque number.
  trust_degree?: number | null
  created_at?: string
}

/**
 * Sprint 101 — one open ask the member has already offered on and now awaits the requester's
 * response. Surfaced as a Home preview (NOT a decision the member owes). Selected server-side from
 * the same distinct-open-ask predicate as the `offeredAwaiting` count, so the count and the rendered
 * items can never disagree.
 */
export interface OfferedAwaitingItem {
  match_id: string
  request_id: string
  title: string
  description?: string
  author_name?: string
  community_id?: string
  community_name?: string
  urgency?: UrgencyLevel
  request_type?: string
  payload_type?: PayloadType
  status: 'proposed'
  offered_at?: string
}

/**
 * Sprint 108 — the curated-home `suggestedAsHelper` payload: open asks where an admin/matchmaker
 * proposed THIS member as helper and the member owes the accept/decline. Home previews them (calm,
 * non-actionable) and links to Helping, where the actionable DecisionBand lives (BUG-015). Shares the
 * OfferedAwaitingItem shape and the same distinct-open-ask predicate, so count and items can't disagree.
 */
export interface SuggestedAsHelper {
  count: number
  items: OfferedAwaitingItem[]
}

/** What a member owes on a decision item, surfaced by the decision band. */
export type DecisionAction =
  | 'accept_offer'
  | 'decline_offer'
  | 'withdraw_offer'
  | 'accept_dibs'
  | 'decline_dibs'
  | 'mark_done'
  // BUG-013: durable rate affordance for a fully-completed match the member hasn't rated yet —
  // surfaced for both parties independently until each rates, so it survives reload.
  | 'rate'

/** The match/dibs/offer kind a decision is about. */
export type DecisionSubjectKind = 'match' | 'dibs' | 'offer'

/**
 * A decision the member owes (the "needs your response" band). Carries the subject to act
 * on (a match/dibs/offer id), enough request context to render the row, and the actions
 * owed. The member's role distinguishes a requester (accept/decline an incoming offer)
 * from a responder (withdraw their own offer).
 */
export interface DecisionData {
  /** id of the match/dibs/offer the action targets. */
  subject_id: string
  subject_kind: DecisionSubjectKind
  request_id: string
  title: string
  community_name: string
  counterparty_name: string
  /** BUG-005: ids needed to attribute a rating when mark_done completes from the band. */
  counterparty_id?: string
  community_id?: string
  /** 'requester' = the member owns the request; 'responder' = the member made the offer. */
  member_role: 'requester' | 'responder'
  actions: DecisionAction[]
  match_score?: number | null
  match_reason?: string
  created_at?: string
  // S86 — request context for the decision band's inline expand (description + payload detail).
  description?: string
  payload?: RequestPayload
  payload_type?: PayloadType
}

/** Texture layer (S86, Community Feed view) — re-uses the existing community-activity shape. */
export type ActivityData = CommunityActivityData

/**
 * The unified feed item union. `priority` is the server-computed action altitude — the
 * client renders items in array order, so the server owns ordering (decisions you owe
 * rank above requests you can fill, which rank above texture).
 */
export type UnifiedFeedItem =
  | { kind: 'request'; priority: number; data: RequestCardData }
  | { kind: 'decision'; priority: number; data: DecisionData }
  | { kind: 'activity'; priority: number; data: ActivityData }
  | { kind: 'story'; priority: number; data: StoryData }

export type UnifiedFeedItemKind = UnifiedFeedItem['kind']
