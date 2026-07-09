/**
 * Sprint 98 — Trust path community context and cache semantics (BUG-098-001 / BUG-098-002)
 *
 * Decisions under test (see docs/bugs/sprint-98-trust-truth-audit.md + ADR-077):
 *  - Exchange-path TOPOLOGY is platform-wide: a completed exchange creates a path
 *    regardless of which community context the caller supplies. The schema cannot
 *    attribute a match to a single community (help_requests has no community_id;
 *    request_communities is many-to-many).
 *  - Community context only scopes trust SCORE / karma + the cache key.
 *  - The route must NEVER pass the literal string 'platform' into the UUID
 *    community_id column. With no community context it falls back to a labeled
 *    platform scope keyed by the PLATFORM_COMMUNITY_ID sentinel (a valid UUID).
 *  - A present-but-malformed X-Community-ID is a client error, not a 500.
 */

jest.mock('../../src/config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

const { pool } = require('../../src/config/database');
import {
  resolveCommunityContext,
  isUuid,
  PLATFORM_COMMUNITY_ID,
} from '../../src/services/communityContext';
import { computeTrustPath } from '../../src/services/pathComputation';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('resolveCommunityContext', () => {
  const realCommunity = '4c9b09f7-caa7-4cbe-8920-000bb2b068e3';
  const jwtCommunity = 'eb32c151-9953-409f-87ad-9abed720e4f4';

  it('uses an explicit X-Community-ID header as community scope', () => {
    const r = resolveCommunityContext(realCommunity, jwtCommunity);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.context.communityId).toBe(realCommunity);
      expect(r.context.scope).toBe('community');
    }
  });

  it('falls back to JWT currentCommunityId when no header is present', () => {
    const r = resolveCommunityContext(undefined, jwtCommunity);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.context.communityId).toBe(jwtCommunity);
      expect(r.context.scope).toBe('community');
    }
  });

  it('falls back to a labeled platform scope (sentinel UUID) when no context exists', () => {
    const r = resolveCommunityContext(undefined, undefined);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.context.scope).toBe('platform');
      // NEVER the literal string 'platform' — must be a real UUID for the UUID column.
      expect(r.context.communityId).toBe(PLATFORM_COMMUNITY_ID);
      expect(r.context.communityId).not.toBe('platform');
      expect(UUID_RE.test(r.context.communityId)).toBe(true);
    }
  });

  it('treats an empty-string header the same as no header (platform fallback)', () => {
    const r = resolveCommunityContext('', undefined);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.context.scope).toBe('platform');
  });

  it('rejects a present-but-malformed X-Community-ID as a client error (no UUID cast 500)', () => {
    const r = resolveCommunityContext('not-a-uuid', jwtCommunity);
    expect(r.ok).toBe(false);
  });

  it('isUuid accepts UUIDs and rejects the legacy "platform" string', () => {
    expect(isUuid(realCommunity)).toBe(true);
    expect(isUuid('platform')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('computeTrustPath — exchange topology is platform-wide', () => {
  const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const community1 = '11111111-1111-4111-8111-111111111111';
  const community2 = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    jest.clearAllMocks();
    // Default for any unscripted query (e.g. trust-edge weight lookup) → empty.
    pool.query.mockResolvedValue({ rows: [] });
  });

  function mockExchangeBetweenAandB() {
    // 1) exchange adjacency (platform-wide completed matches)
    pool.query.mockResolvedValueOnce({ rows: [{ user_a: A, user_b: B }] });
    // 2) user details + karma
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: A, name: 'Alice', karma: 10 },
        { id: B, name: 'Bob', karma: 20 },
      ],
    });
    // 3) exchanged_at lookup for the A-B edge
    pool.query.mockResolvedValueOnce({ rows: [{ completed_at: '2026-06-07T00:00:00Z' }] });
    // remaining (trust-edge weight) handled by default mock → []
  }

  it('returns an exchange degree-1 path when a real community is supplied', async () => {
    mockExchangeBetweenAandB();
    const path = await computeTrustPath(A, B, community1);
    expect(path).not.toBeNull();
    expect(path?.connectionType).toBe('exchange');
    expect(path?.degrees).toBe(1);
  });

  it('returns the SAME exchange path for a different community (topology is platform-wide)', async () => {
    mockExchangeBetweenAandB();
    const path = await computeTrustPath(A, B, community2);
    expect(path).not.toBeNull();
    expect(path?.connectionType).toBe('exchange');
    expect(path?.degrees).toBe(1);

    // The platform-wide exchange graph query must not filter by the community param.
    const graphQueryArgs = pool.query.mock.calls[0][1] as unknown[];
    expect(graphQueryArgs ?? []).not.toContain(community2);
  });

  it('computes a valid path when the platform sentinel is the community context', async () => {
    mockExchangeBetweenAandB();
    const path = await computeTrustPath(A, B, PLATFORM_COMMUNITY_ID);
    expect(path).not.toBeNull();
    expect(path?.connectionType).toBe('exchange');
    // The sentinel is a valid UUID, so karma/trust-edge queries never UUID-cast-fail.
    expect(UUID_RE.test(PLATFORM_COMMUNITY_ID)).toBe(true);
  });
});
