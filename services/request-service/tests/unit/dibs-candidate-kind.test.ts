/**
 * Sprint 92 — BUG-007 (Option A reframe): dibs candidates carry a neighbor/provider
 * discriminator so the UI can frame a mutual-aid first-ask as a *neighbor*, not a
 * "provider."
 *
 * - getEligibleCandidates  (service requests)     → kind = 'provider'
 * - getMutualAidCandidates (non-service requests) → kind = 'neighbor'
 *
 * RED before the candidate functions tag `kind`; GREEN after.
 * Run: npm run test:unit -- dibs-candidate-kind
 */

const mockQuery = jest.fn();
jest.mock('../../src/database/db', () => ({ query: (...args: any[]) => mockQuery(...args) }));

import { getEligibleCandidates, getMutualAidCandidates } from '../../src/db/dibsDb';

describe('Sprint 92 BUG-007: dibs candidates carry a neighbor/provider kind', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getEligibleCandidates tags candidates kind="provider"', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        providerId: 'p1', providerUserId: 'u1', displayName: 'P',
        trustScore: 60, priorInteractions: 2, trustGraphConnection: 'direct', isAvailable: true,
      }],
    });
    const [c] = await getEligibleCandidates('requester', ['c1']);
    expect(c.kind).toBe('provider');
  });

  it('getMutualAidCandidates tags candidates kind="neighbor"', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        providerId: 'n1', providerUserId: 'u2', displayName: 'N',
        trustScore: 55, priorInteractions: 1, trustGraphConnection: 'direct',
      }],
    });
    const [c] = await getMutualAidCandidates('requester', ['c1']);
    expect(c.kind).toBe('neighbor');
  });

  // ADR-072: the candidate query computes a "similar task" interaction count keyed on
  // the canonical similarity expression (payload subtype, falling back to category —
  // NOT raw hr.category, which holds the coarse request_type on new rows) and binds
  // the request's similarity key as $3.
  it('binds the similarity key as $3 and compares on the canonical similarity expression', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        providerId: 'n1', providerUserId: 'u2', displayName: 'N',
        trustScore: 55, priorInteractions: 2, similarPriorInteractions: 1, trustGraphConnection: 'direct',
      }],
    });
    const [c] = await getMutualAidCandidates('requester', ['c1'], 'plumbing');
    expect(c.similarPriorInteractions).toBe(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/prior_similar/);
    expect(sql).toContain("COALESCE(hr.payload->>'service_category', hr.payload->>'item_category', hr.category) = $3");
    expect(params).toEqual(['requester', ['c1'], 'plumbing']);
  });

  it('deriveSimilarityKey prefers the payload task key over the coarse category column', async () => {
    const { deriveSimilarityKey } = await import('../../src/db/dibsDb');
    // New service request: category holds the coarse request_type; payload has the task.
    expect(deriveSimilarityKey({ category: 'service', payload: { service_category: 'plumbing' } })).toBe('plumbing');
    expect(deriveSimilarityKey({ category: 'borrow', payload: { item_category: 'tools' } })).toBe('tools');
    // No finer subtype (ride/event/generic, or legacy skill-token rows) → category.
    expect(deriveSimilarityKey({ category: 'childcare', payload: {} })).toBe('childcare');
    expect(deriveSimilarityKey({ category: null, payload: null })).toBeNull();
  });

  // PR #77 review: the dibs INSERT must run on the caller's transaction executor so it
  // rolls back with the request-status update — on the global pool it would survive a
  // rollback as an orphaned row.
  it('createDibs runs on the provided transaction executor, not the global pool', async () => {
    const { createDibs } = await import('../../src/db/dibsDb');
    const txQuery = jest.fn().mockResolvedValue({ rows: [{ id: 'd1' }] });

    const dibs = await createDibs('req-1', 'u-requester', 'u-provider', new Date(), txQuery);

    expect(dibs).toEqual({ id: 'd1' });
    expect(txQuery).toHaveBeenCalledTimes(1);
    expect(String(txQuery.mock.calls[0][0])).toMatch(/INSERT INTO requests\.dibs/);
    expect(mockQuery).not.toHaveBeenCalled(); // never the pool when a tx executor is given
  });

  it('defaults similarPriorInteractions to 0 when the column is absent', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ providerId: 'p1', providerUserId: 'u1', displayName: 'P', trustScore: 60, priorInteractions: 2, trustGraphConnection: 'direct', isAvailable: true }],
    });
    const [c] = await getEligibleCandidates('requester', ['c1']);
    expect(c.similarPriorInteractions).toBe(0);
  });
});
