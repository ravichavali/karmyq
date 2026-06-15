/**
 * Sprint 99 — Release Experience Audit fixes.
 *
 * Findings from the live demo walkthrough as maria.reyes (see
 * docs/bugs/sprint-99-release-experience-audit.md):
 *   S99-001  Stewardship tab fired admin-only GET /communities/:id/stats for every
 *            member → 403 "Only community admins can view statistics". The client must
 *            mirror that authz so non-admins never trigger the failing request.
 *   S99-002  Dashboard "You're caught up" terminal state claimed "That's everyone" even
 *            though the member's communities held open asks. The empty curated-feed copy
 *            must not deny that community open asks exist.
 *   S99-004  Provider "Get Service" submitted as a bare "Ask neighbours" broadcast, hiding
 *            that the payload already carries preferred_provider_id. The modal must say the
 *            provider is being contacted.
 *   S99-006  The member-facing People roster exposed every member's email. Non-admins must
 *            not see member emails.
 */

import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { canViewCommunityStats } from '@/lib/community/statsVisibility'
import { useCommunityData } from '@/hooks/useCommunityData'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'
import RequestWizard from '@/components/RequestWizard'
import ActiveTab from '@/components/community/tabs/ActiveTab'

const getCuratedRequests = jest.fn()
const getSchemas = jest.fn()
const getMyCommunities = jest.fn()
const getCommunity = jest.fn()
const getNorms = jest.fn()
const getConfig = jest.fn()
const getSettings = jest.fn()
const getStats = jest.fn()

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: (...a: unknown[]) => getCuratedRequests(...a),
    getSchemas: (...a: unknown[]) => getSchemas(...a),
    getRequests: jest.fn().mockResolvedValue({ data: { requests: [] } }),
    createMatch: jest.fn().mockResolvedValue({}),
    acceptMatch: jest.fn().mockResolvedValue({}),
    rejectMatch: jest.fn().mockResolvedValue({}),
    completeMatch: jest.fn().mockResolvedValue({}),
    createRequest: jest.fn().mockResolvedValue({ data: {} }),
  },
  communityService: {
    getMyCommunities: (...a: unknown[]) => getMyCommunities(...a),
    getCommunity: (...a: unknown[]) => getCommunity(...a),
    getNorms: (...a: unknown[]) => getNorms(...a),
    getConfig: (...a: unknown[]) => getConfig(...a),
    getSettings: (...a: unknown[]) => getSettings(...a),
    getStats: (...a: unknown[]) => getStats(...a),
    updateMember: jest.fn().mockResolvedValue({}),
    removeMember: jest.fn().mockResolvedValue({}),
    createNorm: jest.fn().mockResolvedValue({}),
    approveNorm: jest.fn().mockResolvedValue({}),
  },
  reputationService: { getCommunityTrust: jest.fn().mockResolvedValue({ data: null }), getNetworkMetrics: jest.fn().mockResolvedValue({ data: null }), getTrustScore: jest.fn().mockResolvedValue({ data: { data: { score: null } } }) },
  collectiveService: { listCollectivesByCommunity: jest.fn().mockResolvedValue({ data: [] }) },
  dibsService: { acceptDibs: jest.fn(), declineDibs: jest.fn(), sendDibs: jest.fn() },
}))
jest.mock('@/lib/api/providerApi', () => ({ acceptOffer: jest.fn(), declineOffer: jest.fn() }))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

beforeEach(() => {
  getCuratedRequests.mockReset()
  getSchemas.mockReset().mockResolvedValue({ data: { schemas: [] } })
  getMyCommunities.mockReset().mockResolvedValue({ data: { communities: [] } })
  getCommunity.mockReset().mockResolvedValue({ data: { id: 'c1', name: 'C', members: [] } })
  getNorms.mockReset().mockResolvedValue({ data: [] })
  getConfig.mockReset().mockResolvedValue({ data: {} })
  getSettings.mockReset().mockResolvedValue({ data: {} })
  getStats.mockReset().mockResolvedValue({ data: {} })
  localStorage.setItem('user', JSON.stringify({ id: 'me' }))
})

// ── S99-001: client mirrors server "admins only" authz for community stats ──
describe('S99-001: community stats are admin-only on the client', () => {
  it('lets admins load stats and blocks everyone else (mirrors the 403 contract)', () => {
    expect(canViewCommunityStats({ isAdmin: true })).toBe(true)
    expect(canViewCommunityStats({ isAdmin: false })).toBe(false)
  })

  it('does NOT fetch stats on community load (no 403 spam before Stewardship opens)', async () => {
    renderHook(() => useCommunityData('c1'))
    // The community itself loads…
    await waitFor(() => expect(getCommunity).toHaveBeenCalledWith('c1'))
    // …but the admin-only stats endpoint is never hit eagerly.
    expect(getStats).not.toHaveBeenCalled()
  })
})

// ── S99-002: empty curated feed must not deny community open asks ──
describe('S99-002: caught-up state stays truthful about community open asks', () => {
  it('keeps the caught-up heading but points to communities instead of claiming "that\'s everyone"', async () => {
    getCuratedRequests
      .mockResolvedValueOnce({ data: { items: [] } }) // minScore 30
      .mockResolvedValueOnce({ data: { items: [] } }) // widened minScore 0 — still empty

    render(<UnifiedFeed view="home" />)
    fireEvent.click(await screen.findByRole('button', { name: /show more open requests/i }))

    // Heading contract from Sprint 98 is preserved.
    expect(await screen.findByText(/you're caught up/i)).toBeInTheDocument()
    // The home empty state must no longer imply nothing exists anywhere.
    expect(screen.queryByText(/that's everyone for now/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/we'll let you know when a neighbour needs you/i)).not.toBeInTheDocument()
    // It must redirect attention to community open asks.
    expect(screen.getByText(/communities may still have open asks/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse communities/i })).toBeInTheDocument()
  })
})

// ── S99-004: provider Get Service tells the user the provider is contacted ──
describe('S99-004: Get Service makes the provider routing visible', () => {
  it('names the provider on the submit button and notes they are contacted', async () => {
    render(
      <RequestWizard
        onClose={() => {}}
        preferredProviderId="prov-1"
        preferredProviderName="Omar"
        preferredProviderServiceType="generic"
      />,
    )

    // Lands directly on the form for a provider-scoped request.
    expect(await screen.findByText(/request from omar/i)).toBeInTheDocument()
    // The action is no longer a bare "Ask neighbours".
    expect(screen.getByRole('button', { name: /ask omar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^ask neighbours$/i })).toBeNull()
    // And the user is told the provider will see it.
    expect(screen.getByText(/omar.*(see|contact|notif)/i)).toBeInTheDocument()
  })
})

// ── S99-006: member-facing roster hides emails from non-admins ──
describe('S99-006: People roster does not leak emails to non-admins', () => {
  const community: any = {
    id: 'c1',
    creator_id: 'creator',
    members: [
      { id: 'm1', user_id: 'u1', user_name: 'Priya Sharma', user_email: 'priya.sharma@test.karmyq.com', role: 'admin', status: 'active', joined_at: '2026-03-11' },
      { id: 'm2', user_id: 'u2', user_name: 'Layla Lee', user_email: 'layla.lee448@test.karmyq.com', role: 'member', status: 'active', joined_at: '2026-03-11' },
    ],
  }
  const baseProps: any = {
    community, norms: [], memberTrustScores: {}, currentUser: { id: 'me' },
    isMember: true, communityId: 'c1', refetchCommunity: jest.fn(), refetchNorms: jest.fn(),
  }

  it('hides member emails when the viewer is a plain member', () => {
    render(<ActiveTab {...baseProps} isAdmin={false} isAdminOrMod={false} />)
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument()
    expect(screen.queryByText(/priya\.sharma@test\.karmyq\.com/i)).toBeNull()
    expect(screen.queryByText(/layla\.lee448@test\.karmyq\.com/i)).toBeNull()
  })

  it('still shows emails in the admin/mod management table', () => {
    render(<ActiveTab {...baseProps} isAdmin isAdminOrMod />)
    expect(screen.getByText(/priya\.sharma@test\.karmyq\.com/i)).toBeInTheDocument()
  })
})
