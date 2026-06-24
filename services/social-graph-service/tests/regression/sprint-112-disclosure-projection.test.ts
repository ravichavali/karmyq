/**
 * Sprint 112 PR A — Social-graph disclosure projection contract tests (ADR-082).
 *
 * Seeds internal graph/memory objects with NON-ZERO sentinel reputation values and proves the
 * outward projections omit every forbidden key at any depth while preserving identity, structure,
 * degrees, dates, counts, and the qualitative relationship state. A response full of zeroes cannot
 * prove a leak is absent — hence the deliberate sentinels.
 */
import {
  projectPersonGraph,
  projectPersonNode,
  projectPersonLink,
  projectMemoryResponse,
  projectMemoryRelationship,
  relationshipState,
  toRelationshipState,
} from '../../src/services/disclosureProjection';
import {
  SafeBelongingNodeSchema,
  SafeBelongingLinkSchema,
  assertNoForbiddenReputationKeys,
} from '@karmyq/shared';

const CALLER = '11111111-1111-1111-1111-111111111111';
const PEER = '22222222-2222-2222-2222-222222222222';

const S_TRUST = 827;
const S_KARMA = 913;
const S_RAW = 41;
const S_EFF = 37;
const S_CURRENT = 29;

describe('projectPersonNode', () => {
  it('keeps identity/current-user/degrees and drops trust_score + karma', () => {
    const safe = projectPersonNode(
      { id: PEER, name: 'Sam', trust_score: S_TRUST, karma: S_KARMA, isCurrentUser: false, degrees_of_separation: 2 } as any,
      CALLER,
    );
    expect(safe).toEqual({ user_id: PEER, name: 'Sam', is_current_user: false, degrees_of_separation: 2 });
    expect(() => SafeBelongingNodeSchema.parse(safe)).not.toThrow();
    expect(() => assertNoForbiddenReputationKeys(safe)).not.toThrow();
  });

  it('drops the caller node metrics too — self metrics come from the reputation summary only', () => {
    const safe = projectPersonNode(
      { id: CALLER, name: 'Me', trust_score: S_TRUST, karma: S_KARMA, isCurrentUser: true } as any,
      CALLER,
    );
    expect(safe).not.toHaveProperty('trust_score');
    expect(safe).not.toHaveProperty('karma');
    expect(safe.is_current_user).toBe(true);
  });
});

describe('projectPersonLink', () => {
  it('drops raw/effective weights and exposes only a relationship state', () => {
    const safe = projectPersonLink(
      { source: CALLER, target: PEER, raw_weight: S_RAW, effective_weight: S_EFF, currentWeight: S_CURRENT, decayTier: 'warm', type: 'organic' } as any,
      0.5,
    );
    expect(safe).toEqual({ source: CALLER, target: PEER, relationship_state: 'warm', type: 'organic' });
    expect(() => SafeBelongingLinkSchema.parse(safe)).not.toThrow();
    expect(() => assertNoForbiddenReputationKeys(safe)).not.toThrow();
  });

  it('derives relationship_state from weight + threshold when no decayTier is present', () => {
    const safe = projectPersonLink({ source: CALLER, target: PEER, effective_weight: 2.0 } as any, 0.5);
    // r = 2.0/0.5 = 4 -> strong
    expect(safe.relationship_state).toBe('strong');
  });
});

describe('projectPersonGraph', () => {
  it('projects a whole graph free of forbidden keys, preserving meta + topology', () => {
    const internal = {
      nodes: [
        { id: CALLER, name: 'Me', trust_score: S_TRUST, karma: S_KARMA, isCurrentUser: true, degrees_of_separation: 0 },
        { id: PEER, name: 'Sam', trust_score: S_TRUST, karma: S_KARMA, isCurrentUser: false, degrees_of_separation: 1 },
      ],
      links: [
        { source: CALLER, target: PEER, raw_weight: S_RAW, effective_weight: S_EFF, currentWeight: S_CURRENT, decayTier: 'fading' },
      ],
      meta: { depth: 2, truncated: false },
    };
    const safe = projectPersonGraph(internal as any, 0.5, CALLER);
    expect(() => assertNoForbiddenReputationKeys(safe)).not.toThrow();
    expect(safe.nodes.map((n) => n.user_id)).toEqual([CALLER, PEER]);
    expect(safe.links[0].relationship_state).toBe('fading');
    expect(safe.meta).toEqual({ depth: 2, truncated: false });
  });
});

describe('relationship state mapping', () => {
  it('maps swept (never returned outward) to the weakest visible state', () => {
    expect(toRelationshipState('swept')).toBe('nearly_forgotten');
    expect(toRelationshipState('strong')).toBe('strong');
  });
  it('relationshipState bands a weight against the threshold', () => {
    expect(relationshipState(0.6, 0.5)).toBe('nearly_forgotten'); // r=1.2
    expect(relationshipState(5, 0.5)).toBe('strong'); // r=10
  });
});

describe('relationship-memory projection', () => {
  it('strips currentWeight from a peer entry, keeping decay tier + dates + counts', () => {
    const safe = projectMemoryRelationship({
      peerId: PEER,
      peerName: 'Sam',
      currentWeight: S_CURRENT,
      decayTier: 'fading',
      lastInteractionAt: '2026-05-01T00:00:00.000Z',
      matchCompletedCount: 3,
    });
    expect(safe).not.toHaveProperty('currentWeight');
    expect(safe).toEqual({
      peerId: PEER,
      peerName: 'Sam',
      decayTier: 'fading',
      lastInteractionAt: '2026-05-01T00:00:00.000Z',
      matchCompletedCount: 3,
    });
  });

  it('projects the full memory response with no embedded peer weights', () => {
    const safe = projectMemoryResponse({
      activeCount: 5,
      fading: [{ peerId: PEER, peerName: 'Sam', currentWeight: S_CURRENT, decayTier: 'fading' } as any],
      nearlyForgotten: [{ peerId: 'x', peerName: 'Y', currentWeight: S_CURRENT, decayTier: 'nearly_forgotten' } as any],
    });
    expect(safe.activeCount).toBe(5);
    // The peer-only forbidden key currentWeight must be gone at every depth.
    const json = JSON.stringify(safe);
    expect(json).not.toMatch(/currentWeight/);
  });
});
