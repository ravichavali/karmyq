import { jest } from '@jest/globals'

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }))

import { pool } from '../../src/config/database'
import { getFullCommunityGraph } from '../../src/database/trustEdgeDb'
import { projectPersonGraph } from '../../src/services/disclosureProjection'
import { assertNoForbiddenReputationKeys } from '@karmyq/shared'

const query = (pool as any).query

describe('Sprint 115 full-community contract', () => {
  beforeEach(() => query.mockReset())

  it('selects members by normalized name and id, never trust score, and unions the caller', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
    await getFullCommunityGraph('community', 'caller')
    const sql = query.mock.calls[0][0] as string
    expect(sql).toContain('LOWER(BTRIM(u.name))')
    expect(sql).toMatch(/ORDER BY[\s\S]*normalized_name[\s\S]*user_id/)
    expect(sql).toMatch(/LIMIT 149/)
    expect(sql).toMatch(/UNION/)
    expect(sql).toContain('$2::uuid')
    expect(sql).not.toMatch(/ORDER BY\s+trust_score/i)
  })

  it.each([
    [150, 150, false],
    [151, 150, true],
  ])('returns total=%i, returned=%i, truncated=%s', async (total, returned, truncated) => {
    query
      .mockResolvedValueOnce({
        rows: Array.from({ length: returned }, (_, i) => ({
          id: `u-${i}`,
          name: `User ${i}`,
          trust_score: '9',
          karma: '7',
          is_current_user: i === 0,
          total_active_members: String(total),
        })),
      })
      .mockResolvedValueOnce({ rows: [] })
    const graph = await getFullCommunityGraph('community', 'u-0')
    expect(graph.meta).toEqual({ totalActiveMembers: total, truncated })
    const safe = projectPersonGraph(graph, 0.5, 'u-0')
    expect(safe.meta).toEqual(graph.meta)
    expect(() => assertNoForbiddenReputationKeys(safe)).not.toThrow()
  })
})
