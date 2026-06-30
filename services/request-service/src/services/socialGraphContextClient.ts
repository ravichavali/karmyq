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

function relationshipContextUrl(): string {
  const configured = (process.env.SOCIAL_GRAPH_API_URL || 'http://social-graph-service:3010')
    .replace(/\/+$/, '');

  switch (configured) {
    case 'http://social-graph-service:3010':
      return 'http://social-graph-service:3010/internal/relationship-context';
    case 'http://social-graph-service-test:3010':
      return 'http://social-graph-service-test:3010/internal/relationship-context';
    case 'http://localhost:3010':
      return 'http://localhost:3010/internal/relationship-context';
    default:
      throw new RelationshipContextUnavailableError(
        'configuration',
        new Error('SOCIAL_GRAPH_API_URL is not a supported internal social-graph origin'),
      );
  }
}

/** Strict, timeout-bounded service call. Browser auth is intentionally not accepted or forwarded. */
export async function fetchRelationshipTopology(
  viewerId: string,
  counterpartId: string,
): Promise<RelationshipTopology> {
  const secret = requiredInternalSecret();
  const endpoint = relationshipContextUrl();

  let response;
  try {
    response = await axios.post(
      endpoint,
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
