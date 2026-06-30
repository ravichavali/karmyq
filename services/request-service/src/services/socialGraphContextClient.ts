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

export type RelationshipContextFailureKind = 'configuration' | 'transport' | 'upstream' | 'contract';

export class RelationshipContextUnavailableError extends Error {
  readonly kind: RelationshipContextFailureKind;
  readonly cause?: unknown;

  constructor(kind: RelationshipContextFailureKind = 'transport', cause?: unknown) {
    super('Relationship context is temporarily unavailable');
    this.name = 'RelationshipContextUnavailableError';
    this.kind = kind;
    this.cause = cause;
  }
}

function requiredInternalSecret(): string {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    throw new RelationshipContextUnavailableError(
      'configuration',
      new Error('INTERNAL_SECRET is not configured for relationship context'),
    );
  }
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

  let response;
  try {
    // The origin is deployment configuration, never request input.
    // lgtm[js/request-forgery] Trusted service-discovery URL; neither path nor origin uses user data.
    response = await axios.post(
      `${baseUrl}/internal/relationship-context`,
      { viewerId, counterpartId },
      {
        timeout: 2500,
        headers: { 'x-internal-secret': secret },
      },
    );
  } catch (error) {
    throw new RelationshipContextUnavailableError('transport', error);
  }

  if (response.data?.success !== true) {
    throw new RelationshipContextUnavailableError(
      'upstream',
      new Error('Social graph returned an unsuccessful relationship context response'),
    );
  }

  let topology: RelationshipTopology;
  try {
    topology = topologySchema.parse(response.data.data) as RelationshipTopology;
  } catch (error) {
    throw new RelationshipContextUnavailableError('contract', error);
  }
  if (topology.viewer.id !== viewerId || topology.counterpart.id !== counterpartId) {
    throw new RelationshipContextUnavailableError(
      'contract',
      new Error('Social graph relationship context anchors do not match the requested pair'),
    );
  }
  return topology;
}
