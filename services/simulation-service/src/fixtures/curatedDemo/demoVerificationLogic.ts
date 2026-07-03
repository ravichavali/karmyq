/**
 * Sprint 117 — pure, testable mappings from real API response shapes to verification verdicts.
 *
 * These are separated from the CLI I/O so the response-shape contracts (demo-session story IDs,
 * reversed-orientation reciprocity, provider-offer validity) are unit-tested and cannot regress
 * silently the way a mocked-deps contract would miss (e.g. reading a top-level field that actually
 * lives under `demo.stories`).
 */

import type { VerifiedStoryIds } from './verifier';

// --- Relationship context (platform-wide match relationship-context endpoint) ---

export interface RelationshipContextShape {
  path?: { degrees?: number | null };
  networks?: { viewer?: unknown[]; counterpart?: unknown[]; shared?: unknown[] };
}

function nodeId(node: unknown): string | undefined {
  if (node && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    const id = n.user_id ?? n.id ?? n.userId;
    return typeof id === 'string' ? id : undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

function idSet(nodes: unknown[] | undefined): Set<string> {
  return new Set((nodes ?? []).map(nodeId).filter((x): x is string => typeof x === 'string'));
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every(x => b.has(x));
}

/**
 * Reciprocity under reversed orientation. From the helper's viewpoint the viewer/counterpart roles
 * swap, so the two responses are reciprocal iff: both show a finite, equal path degree; both sides
 * have visible one-hop breadth; the shared (mutual) node sets are identical; Maria's exclusive
 * one-hop set equals the helper's counterpart set; and Maria's counterpart set equals the helper's
 * exclusive set. Canonicalized by node id, so ordering is irrelevant.
 */
export function reciprocalContextsMatch(
  maria: RelationshipContextShape,
  helper: RelationshipContextShape,
): boolean {
  const mv = idSet(maria.networks?.viewer);
  const mc = idSet(maria.networks?.counterpart);
  const ms = idSet(maria.networks?.shared);
  const hv = idSet(helper.networks?.viewer);
  const hc = idSet(helper.networks?.counterpart);
  const hs = idSet(helper.networks?.shared);

  const mDeg = typeof maria.path?.degrees === 'number' ? maria.path.degrees : null;
  const hDeg = typeof helper.path?.degrees === 'number' ? helper.path.degrees : null;

  return (
    mDeg !== null && hDeg !== null && mDeg === hDeg &&
    mv.size + ms.size > 0 && hv.size + hs.size > 0 &&
    setsEqual(ms, hs) &&
    setsEqual(mv, hc) &&
    setsEqual(mc, hv)
  );
}

// --- Demo session (POST /auth/demo-session) ---

export interface DemoStoryShape {
  kind?: string;
  requestId?: string;
  matchId?: string;
  offerId?: string;
}

export interface DemoSessionShape {
  token?: string;
  demo?: { stories?: DemoStoryShape[] };
}

/**
 * The published session is coherent iff a token was issued AND its `demo.stories` resolve to exactly
 * the four expected story IDs. IDs live under `demo.stories`, not at the top level — reading the top
 * level makes the check always pass.
 */
export function demoSessionMatchesPublished(session: DemoSessionShape, expected: VerifiedStoryIds): boolean {
  if (!session?.token) return false;
  const stories = session.demo?.stories ?? [];
  const ordinary = stories.find(s => s.kind === 'ordinary');
  const provider = stories.find(s => s.kind === 'provider');
  return Boolean(
    ordinary && provider &&
    ordinary.requestId === expected.ordinaryRequestId &&
    ordinary.matchId === expected.ordinaryMatchId &&
    provider.requestId === expected.providerRequestId &&
    provider.offerId === expected.providerOfferId,
  );
}

// --- Provider offer validity (GET /requests/:id/offers) ---

export interface OfferShape {
  id?: string;
  status?: string;
  provider_user_id?: string;
  provider_id?: string;
  offerer_id?: string;
  user_id?: string;
}

const PENDING_OFFER_STATUSES = new Set(['pending', 'active', 'proposed', 'offered', 'open']);

/**
 * The provider story is coherent iff the configured offer id is actually present in the request's
 * offers, is in a live/pending state, and (when the provider's id is known) belongs to that
 * provider. An empty or mismatched offer list fails closed.
 */
export function providerOfferValid(
  offers: OfferShape[] | null | undefined,
  offerId: string,
  providerId?: string,
): boolean {
  if (!Array.isArray(offers) || offers.length === 0) return false;
  const offer = offers.find(o => o.id === offerId);
  if (!offer) return false;
  if (!PENDING_OFFER_STATUSES.has((offer.status ?? '').toLowerCase())) return false;
  if (providerId) {
    const owner = offer.provider_user_id ?? offer.provider_id ?? offer.offerer_id ?? offer.user_id;
    if (owner && owner !== providerId) return false;
  }
  return true;
}
