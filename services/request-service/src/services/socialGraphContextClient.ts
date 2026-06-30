import axios from 'axios';
import {
  ContextIdentitySchema,
  RelationshipContextSchema,
  type ContextIdentity,
  type RelationshipContext,
} from '@karmyq/shared';

const topologySchema = RelationshipContextSchema
  .omit({ request: true, counterpart: true })
  .extend({ counterpart: ContextIdentitySchema })
  .strict();

export type RelationshipTopology = Omit<RelationshipContext, 'request' | 'counterpart'> & {
  counterpart: ContextIdentity;
};

export class RelationshipContextUnavailableError extends Error {
  constructor() {
    super('Relationship context is temporarily unavailable');
    this.name = 'RelationshipContextUnavailableError';
  }
}

function requiredInternalSecret(): string {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) throw new RelationshipContextUnavailableError();
  return secret;
}

/** Strict, timeout-bounded service call. Browser auth is intentionally not accepted or forwarded. */
export async function fetchRelationshipTopology(
  viewerId: string,
  counterpartId: string,
): Promise<RelationshipTopology> {
  const secret = requiredInternalSecret();
  const baseUrl = (process.env.SOCIAL_GRAPH_API_URL || 'http://social-graph-service:3010')
    .replace(/\/$/, '');

  try {
    // The origin is deployment configuration, never request input.
    // lgtm[js/request-forgery] Trusted service-discovery URL; neither path nor origin uses user data.
    const response = await axios.post(
      `${baseUrl}/internal/relationship-context`,
      { viewerId, counterpartId },
      {
        timeout: 2500,
        headers: { 'x-internal-secret': secret },
      },
    );
    if (response.data?.success !== true) throw new RelationshipContextUnavailableError();
    const topology = topologySchema.parse(response.data.data) as RelationshipTopology;
    if (topology.viewer.id !== viewerId || topology.counterpart.id !== counterpartId) {
      throw new RelationshipContextUnavailableError();
    }
    return topology;
  } catch {
    throw new RelationshipContextUnavailableError();
  }
}
