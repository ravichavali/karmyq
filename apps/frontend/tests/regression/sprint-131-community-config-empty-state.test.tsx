/**
 * Sprint 131 PR A — BUG-045: a community with no config row is an expected empty state.
 *
 * `GET /communities/:id/config` answers 404 when `communities.community_configs` holds no row
 * (services/community-service/src/routes/config.ts:69). That is the server contract and this PR
 * does not change it. The api client's error interceptor re-rejects with the axios error intact
 * (apps/frontend/src/lib/api.ts:166), so the hook can read `err.response.status`.
 *
 * `useCommunityData.fetchConfig` used to log every rejection, so every config-less community wrote
 * "Failed to load configuration" to the console on page load. Only 404 is expected; a 500, a
 * network failure, or anything else still logs, because those are real breakage.
 */
import { act, renderHook, waitFor } from '@testing-library/react'

jest.mock('@/lib/api', () => ({
  communityService: {
    getCommunity: jest.fn(),
    getNorms: jest.fn(),
    getConfig: jest.fn(),
    getSettings: jest.fn(),
  },
  // Imported by useCommunityData but never reached on the mount path under test.
  requestService: {},
  reputationService: {},
  collectiveService: {},
}))

const { communityService } = require('@/lib/api')

import { useCommunityData } from '../../src/hooks/useCommunityData'

// Portland Mutual Aid Network — the community BUG-045 was observed on.
const COMMUNITY_ID = '7f48de77-e6cc-5eba-819b-cb6f50d3c662'

// Post-interceptor success shape: `response.data` is already the envelope's `data`, and the hook
// reads `.config` off it. A second `.data` here would silently make every assertion vacuous.
const CONFIG = {
  id: 'cfg-1',
  community_id: COMMUNITY_ID,
  member_cap: 50,
  visibility_mode: 'community',
}

const axiosError = (status: number, message: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { success: false, message } },
  })

let consoleError: jest.SpyInstance

beforeEach(() => {
  // apps/frontend/jest.config.js sets no clearMocks/resetMocks, so call counts would otherwise
  // accumulate across these tests.
  jest.clearAllMocks()
  localStorage.clear()
  communityService.getCommunity.mockResolvedValue({
    data: { id: COMMUNITY_ID, name: 'Portland Mutual Aid Network', members: [] },
  })
  communityService.getNorms.mockResolvedValue({ data: { norms: [] } })
  communityService.getSettings.mockResolvedValue({ data: {} })
  communityService.getConfig.mockResolvedValue({ data: { config: CONFIG } })
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => consoleError.mockRestore())

// Sibling audit (2026-09-15): neither fetchNorms nor fetchStats gets this treatment.
// GET /:communityId/norms has no 404 path at all (routes/norms.ts:8 — 200 on success, 500 on
// error), so an empty norms list is already a 200. GET /:communityId/stats 404s only with
// "Community not found" (routes/stats.ts:177), which is genuinely exceptional, and it is not
// fetched on mount anyway (see the S99-001 comment in the hook). Both keep logging.
describe('useCommunityData config absence (BUG-045)', () => {
  it('treats an expected 404 as an empty config and logs nothing', async () => {
    communityService.getConfig.mockRejectedValue(
      axiosError(404, 'Community configuration not found'),
    )

    const { result } = renderHook(() => useCommunityData(COMMUNITY_ID))

    await waitFor(() => expect(communityService.getConfig).toHaveBeenCalledWith(COMMUNITY_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('clears a previously loaded config when the row goes away', async () => {
    const { result } = renderHook(() => useCommunityData(COMMUNITY_ID))
    await waitFor(() => expect(result.current.config).toEqual(CONFIG))

    communityService.getConfig.mockRejectedValue(
      axiosError(404, 'Community configuration not found'),
    )
    await act(async () => {
      await result.current.refetchConfig()
    })

    expect(result.current.config).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('still logs a 500 so a broken config endpoint stays visible', async () => {
    communityService.getConfig.mockRejectedValue(axiosError(500, 'Internal server error'))

    renderHook(() => useCommunityData(COMMUNITY_ID))

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Failed to load configuration', {
        error: 'Request failed with status code 500',
      }),
    )
  })

  it('still logs a network failure that carries no response at all', async () => {
    communityService.getConfig.mockRejectedValue(new Error('Network Error'))

    renderHook(() => useCommunityData(COMMUNITY_ID))

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Failed to load configuration', {
        error: 'Network Error',
      }),
    )
  })

  it('still exposes the config from a successful response', async () => {
    const { result } = renderHook(() => useCommunityData(COMMUNITY_ID))

    await waitFor(() => expect(result.current.config).toEqual(CONFIG))
    expect(consoleError).not.toHaveBeenCalled()
  })
})
