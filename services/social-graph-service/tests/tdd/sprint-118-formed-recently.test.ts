/**
 * Sprint 118 / ADR-085 — `formed_recently`: the growing half of the ego graph's
 * growing/fading story.
 *
 * A disclosed neighborhood link gains a qualitative boolean: the pair's FIRST edge formation
 * (MIN(created_at) across the pair's per-community edges) falls within one 30-day window
 * constant. It SUPPLEMENTS the existing decayTier/relationship_state contract — never replaces
 * it, never exposes a timestamp or numeric weight outward (ADR-082 holds).
 *
 * Real projection functions under test (no stubs of logic under test); the links-query shape is
 * pinned via the mocked-pool SQL, matching the service's established unit style.
 */

jest.mock('../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require('../../src/config/database');

import {
  FORMED_RECENTLY_WINDOW_DAYS,
  isFormedRecently,
  projectPersonLink,
  projectPersonGraph,
  toRelationshipState,
} from '../../src/services/disclosureProjection';
import { getTrustNeighborhood } from '../../src/database/trustEdgeDb';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-08T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

describe('Sprint 118: isFormedRecently window semantics', () => {
  it('uses a single 30-day window constant', () => {
    expect(FORMED_RECENTLY_WINDOW_DAYS).toBe(30);
  });

  it('is true for a formation inside the window', () => {
    expect(isFormedRecently(daysAgo(5), NOW)).toBe(true);
    expect(isFormedRecently(daysAgo(29), NOW)).toBe(true);
  });

  it('is false for a formation outside the window', () => {
    expect(isFormedRecently(daysAgo(31), NOW)).toBe(false);
    expect(isFormedRecently(daysAgo(365), NOW)).toBe(false);
  });

  it('fails closed: missing, null, or unparseable formed_at is never "new"', () => {
    expect(isFormedRecently(undefined, NOW)).toBe(false);
    expect(isFormedRecently(null, NOW)).toBe(false);
    expect(isFormedRecently('not-a-date', NOW)).toBe(false);
  });

  it('accepts ISO-string timestamps (pg drivers may return strings)', () => {
    expect(isFormedRecently(daysAgo(3).toISOString(), NOW)).toBe(true);
    expect(isFormedRecently(daysAgo(90).toISOString(), NOW)).toBe(false);
  });
});

describe('Sprint 118: projectPersonLink carries formed_recently, decayTier contract untouched', () => {
  const threshold = 0.5;

  it('projects formed_recently: true for a link whose formed_at is inside the window', () => {
    const link = projectPersonLink(
      { source: 'a', target: 'b', decayTier: 'strong' as const, formed_at: daysAgo(2) },
      threshold,
      NOW,
    );
    expect(link.formed_recently).toBe(true);
  });

  it('projects formed_recently: false for an old formation', () => {
    const link = projectPersonLink(
      { source: 'a', target: 'b', decayTier: 'warm' as const, formed_at: daysAgo(200) },
      threshold,
      NOW,
    );
    expect(link.formed_recently).toBe(false);
  });

  it('projects formed_recently: false when formed_at is absent (fail closed)', () => {
    const link = projectPersonLink(
      { source: 'a', target: 'b', decayTier: 'warm' as const },
      threshold,
      NOW,
    );
    expect(link.formed_recently).toBe(false);
  });

  it('a long-standing pair adding a fresh edge in a new community is NOT new (formed_at = MIN)', () => {
    // The links query MINs created_at across the pair's per-community edges, so the projection
    // input for such a pair is the OLD first-formation date.
    const minFormedAt = daysAgo(400); // first formation, community X (old)
    const link = projectPersonLink(
      { source: 'a', target: 'b', decayTier: 'strong' as const, formed_at: minFormedAt },
      threshold,
      NOW,
    );
    expect(link.formed_recently).toBe(false);
  });

  it('REGRESSION: decayTier → relationship_state mapping is exactly as before', () => {
    expect(toRelationshipState('strong')).toBe('strong');
    expect(toRelationshipState('warm')).toBe('warm');
    expect(toRelationshipState('fading')).toBe('fading');
    expect(toRelationshipState('nearly_forgotten')).toBe('nearly_forgotten');
    expect(toRelationshipState('swept')).toBe('nearly_forgotten');
    // classifyDecayTier ratios vs threshold 0.5: strong ≥3×, warm ≥2×, fading ≥1.3×, nf ≥1×
    for (const [weight, expected] of [
      [10, 'strong'],
      [1.1, 'warm'],
      [0.7, 'fading'],
      [0.5, 'nearly_forgotten'],
    ] as const) {
      const link = projectPersonLink(
        { source: 'a', target: 'b', effective_weight: weight, formed_at: daysAgo(1) },
        threshold,
        NOW,
      );
      expect(link.relationship_state).toBe(expected);
    }
  });

  it('ADR-082: no timestamp and no numeric leaves the projection (exact outward key set)', () => {
    const link = projectPersonLink(
      {
        source: 'a',
        target: 'b',
        decayTier: 'strong' as const,
        formed_at: daysAgo(2),
        effective_weight: 42,
        currentWeight: 42,
      },
      threshold,
      NOW,
    );
    expect(Object.keys(link).sort()).toEqual(
      ['formed_recently', 'relationship_state', 'source', 'target'].sort(),
    );
    const values = Object.values(link) as unknown[];
    expect(values.some(v => v instanceof Date)).toBe(false);
    expect(values.some(v => typeof v === 'number')).toBe(false);
  });

  it('projectPersonGraph threads formed_recently through every link', () => {
    const graph = projectPersonGraph(
      {
        nodes: [{ id: 'a', name: 'A' }],
        links: [
          { source: 'a', target: 'b', decayTier: 'strong' as const, formed_at: daysAgo(1) },
          { source: 'a', target: 'c', decayTier: 'fading' as const, formed_at: daysAgo(300) },
        ],
      },
      threshold,
      'a',
      NOW,
    );
    expect(graph.links.map(l => l.formed_recently)).toEqual([true, false]);
    // decayTier bands untouched
    expect(graph.links.map(l => l.relationship_state)).toEqual(['strong', 'fading']);
  });
});

describe('Sprint 118: neighborhood links query MINs created_at per grouped pair', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it('links query selects MIN(tel.created_at) AS formed_at and maps it onto returned links', async () => {
    pool.query
      // nodes query
      .mockResolvedValueOnce({
        rows: [
          { id: 'user-a', name: 'A', trust_score: 0, karma: 0, degrees_of_separation: 0 },
          { id: 'user-b', name: 'B', trust_score: 0, karma: 0, degrees_of_separation: 1 },
        ],
      })
      // links query
      .mockResolvedValueOnce({
        rows: [
          {
            source: 'user-a',
            target: 'user-b',
            raw_weight: '3',
            effective_weight: '2.5',
            formed_at: daysAgo(4),
          },
        ],
      });

    const result = await getTrustNeighborhood('user-a', ['comm-1'], 1, 80, 'user-a');

    const linksSql = pool.query.mock.calls[1][0] as string;
    expect(linksSql).toContain('MIN(tel.created_at)');
    expect(linksSql.toLowerCase()).toContain('formed_at');
    // GROUP BY the endpoint pair — first formation ACROSS communities is the relationship's age
    expect(linksSql).toContain('GROUP BY tel.user_id_a, tel.user_id_b');

    expect(result.links).toHaveLength(1);
    expect(result.links[0].formed_at).toEqual(daysAgo(4));
  });
});
