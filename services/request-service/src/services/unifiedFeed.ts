/**
 * Unified Feed assembly (Sprint 85 / ADR-066).
 *
 * Pure, side-effect-free helpers for the `GET /requests/curated?view=home` union: score
 * normalization, the decayed prior-interaction signal, server-side action altitude, and the
 * item builders. The route handler does the I/O (SQL) and feeds rows through these so the
 * ranking invariants can be unit-tested directly.
 *
 * Action altitude (direction-doc Principle 3): decisions you owe rank above requests you can
 * fill, which rank above texture (activity/story, S86). The client renders items in array
 * order — the server owns ordering.
 */

// ── Item shape (mirrors apps/frontend/src/types/unified-feed.ts — the wire contract) ──
export type UnifiedFeedItemKind = 'request' | 'decision' | 'activity' | 'story';

export interface UnifiedFeedItem<T = unknown> {
  kind: UnifiedFeedItemKind;
  priority: number;
  data: T;
}

export type DecisionAction =
  | 'accept_offer'
  | 'decline_offer'
  | 'withdraw_offer'
  | 'accept_dibs'
  | 'decline_dibs'
  | 'mark_done';

export type DecisionSubjectKind = 'match' | 'dibs' | 'offer';

export interface DecisionData {
  subject_id: string;
  subject_kind: DecisionSubjectKind;
  request_id: string;
  title: string;
  community_name: string;
  counterparty_name: string;
  // BUG-005: ids the Dashboard rating prompt needs to attribute a rating on mark_done.
  counterparty_id?: string;
  community_id?: string;
  member_role: 'requester' | 'responder';
  actions: DecisionAction[];
  match_score?: number | null;
  match_reason?: string;
  created_at?: string;
  // S86 — request context for the decision band's inline expand (description + payload detail).
  description?: string;
  payload?: unknown;
  payload_type?: string;
}

// ── Priority bands ──
// Decisions (>=2000) always outrank requests (1000–1100), which outrank texture: the community
// activity summary (500) ranks below every request, and stories (100) rank below activity (S86).
export const PRIORITY_DECISION_BASE = 2000;
export const PRIORITY_REQUEST_BASE = 1000;
export const PRIORITY_ACTIVITY_BASE = 500;
export const PRIORITY_STORY_BASE = 100;

// Within the decision band, the response a counterparty is waiting on outranks the member's
// own housekeeping (withdraw / mark-done). Kept < 1000 so the band can never collide with
// the request band even at its ceiling.
const DECISION_ACTION_WEIGHT: Record<DecisionAction, number> = {
  accept_offer: 50,
  decline_offer: 50,
  accept_dibs: 40,
  decline_dibs: 40,
  withdraw_offer: 30,
  mark_done: 10,
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Normalize a match score to one 0–100 integer scale. Accepts a 0–1 fraction (scaled up) or
 * a value already on 0–100. Absent/invalid → null (never 0, which is a legitimate score).
 */
export function normalizeMatchScore(raw: number | null | undefined): number | null {
  if (raw == null || Number.isNaN(raw)) return null;
  const scaled = raw > 0 && raw <= 1 ? raw * 100 : raw;
  return Math.round(clamp(scaled, 0, 100));
}

/**
 * Prior-interaction signal from the *decayed* trust-edge weight ("designed to forget",
 * ADR-066 promise). `current_weight` from `social_graph.trust_edges_live` is
 * `raw_weight × e^(-Δt / (stability·half_life))`, so a fresh completed match (raw_weight ≈ 10)
 * maps to ~100 and a long-dormant edge decays toward 0 regardless of how many raw interactions
 * once occurred. Ranking therefore reflects relationship *shape*, not raw history.
 */
export function scorePriorInteraction(currentWeight: number | null | undefined): number {
  if (currentWeight == null || Number.isNaN(currentWeight) || currentWeight <= 0) return 0;
  return clamp(Math.round(currentWeight * 10), 0, 100);
}

/** Server-side action altitude for a request the member can fill (higher feed score = higher). */
export function requestPriority(feedScore: number): number {
  return PRIORITY_REQUEST_BASE + clamp(Math.round(feedScore), 0, 100);
}

/** Server-side action altitude for a decision the member owes. */
export function decisionPriority(actions: DecisionAction[]): number {
  const weight = actions.reduce((max, a) => Math.max(max, DECISION_ACTION_WEIGHT[a] ?? 0), 0);
  return PRIORITY_DECISION_BASE + weight;
}

/** Wrap a decision payload into a ranked union item. */
export function buildDecisionItem(data: DecisionData): UnifiedFeedItem<DecisionData> {
  return { kind: 'decision', priority: decisionPriority(data.actions), data };
}

/** Wrap a request-card payload into a ranked union item. */
export function buildRequestItem<T>(data: T, feedScore: number): UnifiedFeedItem<T> {
  return { kind: 'request', priority: requestPriority(feedScore), data };
}

/**
 * Assemble a unified feed (either view): a stable sort by descending priority (action altitude).
 * Ties keep input order, so callers can pre-sort within a band (e.g. requests by feed score, or
 * stories by recency) and trust that ordering to survive. Serves both `view=home` (decisions +
 * requests) and `view=community` (requests + activity + story).
 */
export function assembleFeed(items: UnifiedFeedItem[]): { items: UnifiedFeedItem[] } {
  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.priority - a.item.priority || a.index - b.index)
    .map(({ item }) => item);
  return { items: sorted };
}

/** Back-compat alias for the original `view=home` caller/tests. */
export const assembleHomeFeed = assembleFeed;
