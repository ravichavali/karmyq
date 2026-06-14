/**
 * Sprint 98 — Frontend trust-path community context (BUG-098-001)
 *
 * useTrustPath() fetched paths without a community context, so a badge rendered on a
 * community-scoped surface could describe a path computed under a different (default)
 * community. The hook now accepts an optional communityId and passes it through to the
 * social-graph API; community-scoped surfaces (a request card) supply their community.
 *
 * Also: localStorage may hold a corrupt 'user' value — JSON.parse must not crash the hook.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { useTrustPath } from '../../src/hooks/useTrustPath'

jest.mock('../../src/lib/api', () => ({
  socialGraphService: {
    getTrustPath: jest.fn(),
    getBatchTrustPaths: jest.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { socialGraphService } = require('../../src/lib/api')

describe('Sprint 98: useTrustPath community context', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id: 'me' }))
    socialGraphService.getTrustPath.mockResolvedValue({ data: { degrees_of_separation: 1, scope: 'community' } })
  })

  it('passes the supplied communityId to the trust-path API', async () => {
    renderHook(() => useTrustPath('target-1', { communityId: 'comm-xyz' }))
    await waitFor(() => expect(socialGraphService.getTrustPath).toHaveBeenCalled())
    expect(socialGraphService.getTrustPath).toHaveBeenCalledWith('target-1', 'comm-xyz')
  })

  it('omits community context (platform-wide) when no communityId is supplied', async () => {
    renderHook(() => useTrustPath('target-1'))
    await waitFor(() => expect(socialGraphService.getTrustPath).toHaveBeenCalled())
    expect(socialGraphService.getTrustPath).toHaveBeenCalledWith('target-1', undefined)
  })

  it('does not crash when localStorage "user" is corrupt JSON', async () => {
    localStorage.setItem('user', '{not valid json')
    const { result } = renderHook(() => useTrustPath('target-1', { communityId: 'comm-xyz' }))
    // The hook still fetches (treating the current user as unknown) rather than throwing.
    await waitFor(() => expect(socialGraphService.getTrustPath).toHaveBeenCalled())
    expect(result.current.error).toBeNull()
  })

  it('does not fetch a path to the current user', async () => {
    renderHook(() => useTrustPath('me', { communityId: 'comm-xyz' }))
    // microtask flush — the self-path guard short-circuits before any API call.
    await new Promise((r) => setTimeout(r, 0))
    expect(socialGraphService.getTrustPath).not.toHaveBeenCalled()
  })
})
