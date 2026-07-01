/**
 * Demo Session Service (Sprint 116, ADR-084)
 *
 * Issues a short-lived, server-side read-only session for the synthetic Maria persona
 * so `karmyq.com/demo` can walk a live-but-safe helping story. Every failure — disabled
 * config, missing IDs, wrong persona, incoherent story rows — collapses to a single
 * generic `DemoSessionUnavailableError`, so the endpoint can return one opaque 503 and
 * never leak which resource does or does not exist.
 *
 * Safety invariants enforced here (identity), complemented by the shared auth
 * middleware's read-only write guard (authorization):
 *   - The persona is configured by email, but the *resolved account* must independently
 *     be a real `@test.karmyq.com` synthetic account.
 *   - The account must be active (>=1 active membership) and non-admin (no active admin
 *     membership) — a demo must never impersonate a steward.
 *   - Both stories must be coherent: Maria owns each request, and the match/offer hang
 *     off the correct request.
 *   - The token carries `sessionMode: 'demo_read_only'`, lasts 30 minutes, and no refresh
 *     token is ever issued.
 */

import jwt from 'jsonwebtoken';
import { JWTPayload } from '@karmyq/shared/middleware/auth';
import { query } from '../database/db';

const DEMO_TOKEN_TTL_MINUTES = 30;
const SYNTHETIC_EMAIL_SUFFIX = '@test.karmyq.com';

/**
 * Single opaque failure for every config/state problem. The route maps this to one
 * generic 503 so resource existence is never leaked through the demo entry point.
 */
export class DemoSessionUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'DemoSessionUnavailableError';
  }
}

export interface DemoPersona {
  id: string;
  email: string;
  name: string;
}

export interface MembershipRole {
  role: string;
  status: string;
}

export interface RequestOwner {
  id: string;
  requester_id: string;
}

export interface RequestChild {
  id: string;
  request_id: string;
}

export interface DemoCommunity {
  id: string;
  role: 'admin' | 'member';
  name: string;
}

/**
 * Injectable data access so the service is unit-testable without a live database.
 * Production callers use {@link defaultDemoSessionDeps}.
 */
export interface DemoSessionDeps {
  getPersonaByEmail(email: string): Promise<DemoPersona | null>;
  getMembershipRoles(userId: string): Promise<MembershipRole[]>;
  getRequestOwner(requestId: string): Promise<RequestOwner | null>;
  getMatch(matchId: string): Promise<RequestChild | null>;
  getProviderOffer(offerId: string): Promise<RequestChild | null>;
  getUserCommunities(userId: string): Promise<DemoCommunity[]>;
}

export interface DemoStory {
  kind: 'ordinary' | 'provider';
  requestId: string;
  matchId?: string;
  offerId?: string;
}

export interface DemoSessionResult {
  user: {
    id: string;
    email: string;
    name: string;
    communities: DemoCommunity[];
  };
  token: string;
  demo: {
    expiresInMinutes: number;
    stories: DemoStory[];
  };
}

interface DemoConfig {
  personaEmail: string;
  ordinaryRequestId: string;
  ordinaryMatchId: string;
  providerRequestId: string;
  providerOfferId: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new DemoSessionUnavailableError(`Missing demo config: ${name}`);
  }
  return value.trim();
}

function readConfig(): DemoConfig {
  if (process.env.DEMO_SESSION_ENABLED !== 'true') {
    throw new DemoSessionUnavailableError('Demo sessions are disabled');
  }
  const personaEmail = requireEnv('DEMO_PERSONA_EMAIL');
  if (!personaEmail.toLowerCase().endsWith(SYNTHETIC_EMAIL_SUFFIX)) {
    throw new DemoSessionUnavailableError('Configured persona is not a synthetic account');
  }
  return {
    personaEmail,
    ordinaryRequestId: requireEnv('DEMO_ORDINARY_REQUEST_ID'),
    ordinaryMatchId: requireEnv('DEMO_ORDINARY_MATCH_ID'),
    providerRequestId: requireEnv('DEMO_PROVIDER_REQUEST_ID'),
    providerOfferId: requireEnv('DEMO_PROVIDER_OFFER_ID'),
  };
}

export const defaultDemoSessionDeps: DemoSessionDeps = {
  async getPersonaByEmail(email) {
    const result = await query(
      'SELECT id, email, name FROM auth.users WHERE lower(email) = lower($1)',
      [email]
    );
    return result.rows[0] ?? null;
  },
  async getMembershipRoles(userId) {
    const result = await query(
      'SELECT role, status FROM communities.members WHERE user_id = $1',
      [userId]
    );
    return result.rows;
  },
  async getRequestOwner(requestId) {
    const result = await query(
      'SELECT id, requester_id FROM requests.help_requests WHERE id = $1',
      [requestId]
    );
    return result.rows[0] ?? null;
  },
  async getMatch(matchId) {
    const result = await query(
      'SELECT id, request_id FROM requests.matches WHERE id = $1',
      [matchId]
    );
    return result.rows[0] ?? null;
  },
  async getProviderOffer(offerId) {
    const result = await query(
      'SELECT id, request_id FROM provider.offers WHERE id = $1',
      [offerId]
    );
    return result.rows[0] ?? null;
  },
  async getUserCommunities(userId) {
    const result = await query(
      `SELECT cm.community_id AS id, cm.role, c.name
         FROM communities.members cm
         JOIN communities.communities c ON cm.community_id = c.id
        WHERE cm.user_id = $1 AND cm.status = 'active'
        ORDER BY cm.joined_at DESC`,
      [userId]
    );
    return result.rows.map((row: any) => ({ id: row.id, role: row.role, name: row.name }));
  },
};

/**
 * Build (but do not persist) a read-only Maria demo session, or throw
 * {@link DemoSessionUnavailableError} on any config/state problem.
 */
export async function createDemoSession(
  deps: DemoSessionDeps = defaultDemoSessionDeps
): Promise<DemoSessionResult> {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new DemoSessionUnavailableError('JWT secret not configured');
  }

  const config = readConfig();

  const persona = await deps.getPersonaByEmail(config.personaEmail);
  if (!persona) {
    throw new DemoSessionUnavailableError('Persona not found');
  }
  // The resolved account must independently be synthetic — config alone is not trusted.
  if (!persona.email.toLowerCase().endsWith(SYNTHETIC_EMAIL_SUFFIX)) {
    throw new DemoSessionUnavailableError('Resolved persona is not a synthetic account');
  }

  const memberships = await deps.getMembershipRoles(persona.id);
  const activeMemberships = memberships.filter((m) => m.status === 'active');
  if (activeMemberships.length === 0) {
    throw new DemoSessionUnavailableError('Persona is not active');
  }
  if (activeMemberships.some((m) => m.role === 'admin')) {
    throw new DemoSessionUnavailableError('Persona is an admin');
  }

  // Story coherence: Maria owns each request; the match/offer hang off the right request.
  const [ordinaryRequest, providerRequest, match, offer] = await Promise.all([
    deps.getRequestOwner(config.ordinaryRequestId),
    deps.getRequestOwner(config.providerRequestId),
    deps.getMatch(config.ordinaryMatchId),
    deps.getProviderOffer(config.providerOfferId),
  ]);

  if (!ordinaryRequest || ordinaryRequest.requester_id !== persona.id) {
    throw new DemoSessionUnavailableError('Ordinary request is not owned by the persona');
  }
  if (!providerRequest || providerRequest.requester_id !== persona.id) {
    throw new DemoSessionUnavailableError('Provider request is not owned by the persona');
  }
  if (!match || match.request_id !== config.ordinaryRequestId) {
    throw new DemoSessionUnavailableError('Match does not belong to the ordinary request');
  }
  if (!offer || offer.request_id !== config.providerRequestId) {
    throw new DemoSessionUnavailableError('Offer does not belong to the provider request');
  }

  const communities = await deps.getUserCommunities(persona.id);

  const payload: JWTPayload = {
    userId: persona.id,
    email: persona.email,
    communities,
    currentCommunityId: communities.length > 0 ? communities[0].id : undefined,
    sessionMode: 'demo_read_only',
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: `${DEMO_TOKEN_TTL_MINUTES}m` });

  return {
    user: { id: persona.id, email: persona.email, name: persona.name, communities },
    token,
    demo: {
      expiresInMinutes: DEMO_TOKEN_TTL_MINUTES,
      stories: [
        { kind: 'ordinary', requestId: config.ordinaryRequestId, matchId: config.ordinaryMatchId },
        { kind: 'provider', requestId: config.providerRequestId, offerId: config.providerOfferId },
      ],
    },
  };
}
