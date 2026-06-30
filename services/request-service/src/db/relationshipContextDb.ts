import type { ContextCounterpart } from '@karmyq/shared';
import { query } from '../database/db';
import {
  getRequestReachability,
  type RequestReachability,
} from './eligibility';

export type ContextVisibilityScope = 'community' | 'trust_network' | 'platform';
export type ContextReachability =
  | 'same_community'
  | 'sister_community'
  | 'trust_network'
  | 'platform';
type ProviderServiceType = Extract<ContextCounterpart, { role: 'provider' }>['provider']['serviceType'];

export type ContextPair = {
  viewerId: string;
  counterpartId: string;
  requestId: string;
  visibilityScope: ContextVisibilityScope;
  reachability: ContextReachability;
  provider?: { serviceType: ProviderServiceType; collectiveName?: string };
};

export type ContextResolution =
  | { kind: 'ok'; pair: ContextPair }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'unavailable' }
  | { kind: 'no_context' };

function visibilityScope(value: string | null): ContextVisibilityScope {
  if (value === 'community' || value === 'trust_network' || value === 'platform') return value;
  throw new Error(`Unsupported request visibility scope: ${value}`);
}

function reachabilityFor(
  result: RequestReachability,
  scope: ContextVisibilityScope,
): ContextReachability | null {
  if (result.reachability) return result.reachability;
  // Historical match/offer rows do not persist the original source tier. The request's own wide
  // scope is still authoritative; a community-scoped row could have been same- or sister-community,
  // so fail unavailable rather than inventing one after memberships change.
  if (scope === 'trust_network' || scope === 'platform') return scope;
  return null;
}

export async function resolveRequestPair(
  requestId: string,
  viewerId: string,
): Promise<ContextResolution> {
  const result = await getRequestReachability(requestId, viewerId);
  if (!result.exists || !result.requesterId) return { kind: 'not_found' };
  if (result.requesterId === viewerId) return { kind: 'no_context' };
  if (result.status !== 'open' || result.expired === true) return { kind: 'forbidden' };
  if (!result.reachable || !result.reachability) return { kind: 'forbidden' };
  const scope = visibilityScope(result.visibilityScope);
  return {
    kind: 'ok',
    pair: {
      viewerId,
      counterpartId: result.requesterId,
      requestId,
      visibilityScope: scope,
      reachability: result.reachability,
    },
  };
}

export async function resolveMatchPair(
  requestId: string,
  matchId: string,
  viewerId: string,
): Promise<ContextResolution> {
  const match = await query(
    `SELECT hr.requester_id, m.responder_id, hr.visibility_scope
     FROM requests.matches m
     JOIN requests.help_requests hr ON hr.id = m.request_id
     WHERE m.request_id = $1 AND m.id = $2`,
    [requestId, matchId],
  );
  const row = match.rows[0];
  if (!row) return { kind: 'not_found' };
  if (viewerId !== row.requester_id && viewerId !== row.responder_id) return { kind: 'forbidden' };

  const helperReachability = await getRequestReachability(requestId, row.responder_id);
  const scope = visibilityScope(helperReachability.visibilityScope ?? row.visibility_scope);
  const reachability = reachabilityFor(helperReachability, scope);
  // The participant remains authorized, but the historical same-vs-sister source tier was not
  // persisted. No context is more truthful than a fabricated tier or a transient-looking 503.
  if (!reachability) return { kind: 'no_context' };
  return {
    kind: 'ok',
    pair: {
      viewerId,
      counterpartId: viewerId === row.requester_id ? row.responder_id : row.requester_id,
      requestId,
      visibilityScope: scope,
      reachability,
    },
  };
}

export async function resolveProviderOfferPair(
  requestId: string,
  offerId: string,
  viewerId: string,
): Promise<ContextResolution> {
  const offer = await query(
    `SELECT hr.requester_id, o.provider_user_id, hr.visibility_scope, pp.service_type,
            (SELECT pc.name
               FROM requests.provider_collective_members pcm
               JOIN requests.provider_collectives pc ON pc.id = pcm.collective_id
              WHERE pcm.provider_id = o.provider_id AND pc.is_active = true
              ORDER BY pc.name ASC
              LIMIT 1) AS collective_name
     FROM provider.offers o
     JOIN requests.help_requests hr ON hr.id = o.request_id
     JOIN requests.provider_profiles pp
       ON pp.id = o.provider_id AND pp.user_id = o.provider_user_id
     WHERE o.request_id = $1 AND o.id = $2`,
    [requestId, offerId],
  );
  const row = offer.rows[0];
  if (!row) return { kind: 'not_found' };
  if (viewerId !== row.requester_id && viewerId !== row.provider_user_id) return { kind: 'forbidden' };

  const providerReachability = await getRequestReachability(requestId, row.provider_user_id);
  const scope = visibilityScope(providerReachability.visibilityScope ?? row.visibility_scope);
  const reachability = reachabilityFor(providerReachability, scope);
  if (!reachability) return { kind: 'no_context' };
  const requesterIsViewing = viewerId === row.requester_id;
  return {
    kind: 'ok',
    pair: {
      viewerId,
      counterpartId: requesterIsViewing ? row.provider_user_id : row.requester_id,
      requestId,
      visibilityScope: scope,
      reachability,
      ...(requesterIsViewing && {
        provider: {
          serviceType: row.service_type as ProviderServiceType,
          // Disclose the collective only when the provider acts under one; a solo provider has none.
          ...(row.collective_name ? { collectiveName: row.collective_name as string } : {}),
        },
      }),
    },
  };
}
