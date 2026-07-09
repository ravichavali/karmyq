/**
 * Sprint 118 / ADR-085 — invite-primary join funnel + the /welcome arrival moment.
 *
 * - /invite/[code] is the landing: inviter + community context card with the form inside;
 *   success preserves every registration side effect and routes to /welcome with invite context.
 * - /register gains an invite-primary nudge; the open path still lands on /communities?welcome=true.
 * - The communities welcome-flow first join routes to /welcome and STOPS pre-setting the
 *   onboarded key (it is written only when /welcome completes or is skipped).
 * - /welcome renders the member's actual nascent graph via ArrivalGraph (never sparse-gated);
 *   the invitation bond is provenance, NOT a trust edge (rendered distinctly, becomes-trust copy).
 * - WelcomeModal gates on the user-scoped key, honoring the legacy global key.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const mockRouter = {
  query: {} as Record<string, unknown>,
  pathname: '/',
  push: jest.fn(),
  replace: jest.fn(),
}
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn(),
    defaults: { headers: { common: {} } },
  },
  communityService: {
    getCommunities: jest.fn(),
    getCommunityTags: jest.fn(),
    joinCommunity: jest.fn(),
    getMyCommunities: jest.fn(),
  },
  reputationService: {
    getCommunityTrust: jest.fn(),
  },
  socialGraphService: {
    validateInvitationCode: jest.fn(),
    acceptInvitationCode: jest.fn(),
    getFullCommunityGraph: jest.fn(),
  },
}))

jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/OnboardingOverlay', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({ shouldShow: false, markSeen: jest.fn() }),
}))
jest.mock('@/components/DiscoveryToggle', () => ({
  __esModule: true,
  default: () => null,
  readDiscoveryMode: () => 'interests',
}))

const { api, communityService, reputationService, socialGraphService } = require('@/lib/api')

import InvitePage from '../../src/pages/invite/[code]'
import RegisterPage from '../../src/pages/register'
import CommunitiesPage from '../../src/pages/communities/index'
import WelcomePage from '../../src/pages/welcome'
import WelcomeModal from '../../src/components/WelcomeModal'

const USER = { id: 'user-1', name: 'Nova New', email: 'nova@example.com' }

const INVITE_INFO = {
  inviter_name: 'Maria Reyes',
  community_name: 'Berkeley Community Care',
  community_id: 'comm-1',
}

const ARRIVAL_KEY = 'karmyq_arrival'
const onboardedKeyFor = (userId: string) => `karmyq_onboarded:${userId}`

function fillAndSubmitAccountForm() {
  fireEvent.change(screen.getByLabelText(/full name|^name$/i), { target: { value: USER.name } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: USER.email } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'hunter2hunter2' } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'hunter2hunter2' } })
  fireEvent.click(screen.getByRole('button', { name: /join|create/i }))
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  mockRouter.query = {}
  mockRouter.push.mockReset()
  mockRouter.replace.mockReset()
})

describe('invite landing (/invite/[code])', () => {
  beforeEach(() => {
    mockRouter.query = { code: 'KARMYQ-CODE-1' }
    socialGraphService.validateInvitationCode.mockResolvedValue({
      data: { data: INVITE_INFO },
    })
  })

  it('renders the inviter + community context as the landing with the account form inside it', async () => {
    render(<InvitePage />)
    expect((await screen.findAllByText(/maria reyes/i)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/berkeley community care/i).length).toBeGreaterThan(0)
    // the form lives on the same landing
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
  })

  it('submit registers, accepts the invite, preserves every side effect, and routes to /welcome with invite context', async () => {
    localStorage.setItem('demoContext', '{"demo":true}')
    api.post.mockImplementation((url: string) => {
      if (url === '/auth/register') {
        return Promise.resolve({
          data: { token: 'tok.reg.1', refreshToken: 'refresh-1', user: USER },
        })
      }
      if (url === '/auth/login') {
        return Promise.resolve({
          data: {
            token: 'tok.fresh.2',
            refreshToken: 'refresh-2',
            user: { ...USER, communities: [{ id: 'comm-1', name: 'Berkeley Community Care', role: 'member' }] },
          },
        })
      }
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    socialGraphService.acceptInvitationCode.mockResolvedValue({
      data: { inviter_id: 'inviter-9', community_id: 'comm-1' },
    })

    render(<InvitePage />)
    await screen.findAllByText(/maria reyes/i)
    fillAndSubmitAccountForm()

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/welcome'))

    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      name: USER.name,
      email: USER.email,
      password: 'hunter2hunter2',
    })
    expect(socialGraphService.acceptInvitationCode).toHaveBeenCalledWith('KARMYQ-CODE-1')

    // registration side effects (note 7): token, refreshToken, user stored; demoContext cleared
    expect(localStorage.getItem('token')).toBe('tok.fresh.2')
    expect(localStorage.getItem('refreshToken')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('user') || '{}').id).toBe(USER.id)
    expect(localStorage.getItem('demoContext')).toBeNull()

    // the arrival context travels to /welcome
    const arrival = JSON.parse(sessionStorage.getItem(ARRIVAL_KEY) || '{}')
    expect(arrival).toMatchObject({
      path: 'invite',
      inviterName: 'Maria Reyes',
      communityId: 'comm-1',
      communityName: 'Berkeley Community Care',
    })
    // no onboarded key is pre-set — /welcome owns that
    expect(localStorage.getItem(onboardedKeyFor(USER.id))).toBeNull()
    expect(localStorage.getItem('karmyq_onboarded')).toBeNull()
  })
})

describe('register page (open path)', () => {
  it('renders the invite-primary nudge above the form', () => {
    render(<RegisterPage />)
    expect(screen.getByText(/invitation/i)).toBeInTheDocument()
  })

  it('open-path submit still stores side effects and routes to /communities?welcome=true', async () => {
    api.post.mockResolvedValue({
      data: { token: 'tok.1', refreshToken: 'refresh-1', user: USER },
    })
    render(<RegisterPage />)
    fillAndSubmitAccountForm()
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith('/communities?welcome=true')
    )
    expect(localStorage.getItem('token')).toBe('tok.1')
  })
})

describe('communities welcome-flow first join', () => {
  const COMMUNITY = {
    id: 'comm-1',
    name: 'Berkeley Community Care',
    description: 'Neighbours helping neighbours',
    location: 'Berkeley',
    category: 'Neighborhood',
    current_members: 12,
    max_members: 50,
    access_type: 'public' as const,
    creator_name: 'Ada Admin',
    created_at: '2026-01-01',
    inner_circle_count: 1,
    active_community_count: 1,
    extended_network_count: 1,
  }

  beforeEach(() => {
    mockRouter.query = { welcome: 'true' }
    localStorage.setItem('token', 'not-a-decodable-jwt')
    localStorage.setItem('user', JSON.stringify({ ...USER, communities: [] }))
    communityService.getCommunityTags.mockResolvedValue({ data: { tags: [] } })
    communityService.getCommunities.mockResolvedValue({
      data: { communities: [COMMUNITY], fallback: false },
    })
    communityService.joinCommunity.mockResolvedValue({ data: { token: undefined } })
    reputationService.getCommunityTrust.mockResolvedValue({ data: { data: { score: null } } })
  })

  it('routes the first public join to /welcome with arrival context and does NOT pre-set any onboarded key', async () => {
    render(<CommunitiesPage />)
    const joinButton = await screen.findByRole('button', { name: /join community/i })
    await act(async () => {
      fireEvent.click(joinButton)
    })

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/welcome'))

    expect(localStorage.getItem('karmyq_onboarded')).toBeNull()
    expect(localStorage.getItem(onboardedKeyFor(USER.id))).toBeNull()

    const arrival = JSON.parse(sessionStorage.getItem(ARRIVAL_KEY) || '{}')
    expect(arrival).toMatchObject({
      path: 'open',
      communityId: 'comm-1',
      communityName: 'Berkeley Community Care',
    })
  })
})

describe('/welcome arrival moment', () => {
  const RING_GRAPH = {
    data: {
      nodes: [
        { user_id: USER.id, name: USER.name, is_current_user: true },
        { user_id: 'inviter-9', name: 'Maria Reyes', is_current_user: false },
        { user_id: 'n-1', name: 'Sam Okafor', is_current_user: false },
      ],
      links: [], // zero trust edges — the intended arrival picture, never an empty state
    },
  }

  function seedInviteArrival() {
    localStorage.setItem('token', 'tok')
    localStorage.setItem('user', JSON.stringify(USER))
    sessionStorage.setItem(
      ARRIVAL_KEY,
      JSON.stringify({
        path: 'invite',
        userId: USER.id,
        inviterId: 'inviter-9',
        inviterName: 'Maria Reyes',
        communityId: 'comm-1',
        communityName: 'Berkeley Community Care',
      })
    )
    socialGraphService.getFullCommunityGraph.mockResolvedValue(RING_GRAPH)
  }

  function seedOpenArrival() {
    localStorage.setItem('token', 'tok')
    localStorage.setItem('user', JSON.stringify(USER))
    sessionStorage.setItem(
      ARRIVAL_KEY,
      JSON.stringify({ path: 'open', userId: USER.id, communityId: 'comm-1', communityName: 'Berkeley Community Care' })
    )
    socialGraphService.getFullCommunityGraph.mockResolvedValue(RING_GRAPH)
  }

  it('invite arrival renders the invitation bond distinctly with the becomes-trust copy', async () => {
    seedInviteArrival()
    const { container } = render(<WelcomePage />)
    expect(await screen.findByTestId('arrival-graph')).toBeInTheDocument()
    // the bond is provenance, not a trust edge — distinct styling + explicit copy
    expect(container.querySelector('[data-invitation-bond]')).toBeTruthy()
    expect(screen.getAllByText(/becomes trust/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/maria reyes/i).length).toBeGreaterThan(0)
  })

  it('open arrival renders you on the community ring with ZERO trust edges — no sparse empty state', async () => {
    seedOpenArrival()
    const { container } = render(<WelcomePage />)
    expect(await screen.findByTestId('arrival-graph')).toBeInTheDocument()
    // self is on the ring
    expect(container.querySelector(`[data-node-id="${USER.id}"]`)).toBeTruthy()
    // no invitation bond on the open path
    expect(container.querySelector('[data-invitation-bond]')).toBeNull()
    // and definitely not the ego sparse short-circuit copy
    expect(screen.queryByText(/don't have any trust connections/i)).not.toBeInTheDocument()
  })

  it('the single CTA leads to the community, and completing writes the user-scoped onboarded key', async () => {
    seedInviteArrival()
    render(<WelcomePage />)
    const cta = await screen.findByRole('button', { name: /see.*asks|open asks/i })
    fireEvent.click(cta)
    expect(localStorage.getItem(onboardedKeyFor(USER.id))).toBe('1')
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith(expect.stringContaining('/communities/comm-1'))
    )
  })

  it('skip is as graceful as completion: same key, same guided destination', async () => {
    seedInviteArrival()
    render(<WelcomePage />)
    const skip = await screen.findByRole('button', { name: /skip/i })
    fireEvent.click(skip)
    expect(localStorage.getItem(onboardedKeyFor(USER.id))).toBe('1')
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith(expect.stringContaining('/communities/comm-1'))
    )
  })

  it("another account's stale arrival context on the same tab is dropped, never replayed", async () => {
    // User A left a context behind (sessionStorage survives logout); User B is now signed in and
    // already onboarded — B must see nothing of A's arrival.
    localStorage.setItem('token', 'tok')
    localStorage.setItem('user', JSON.stringify(USER))
    localStorage.setItem(onboardedKeyFor(USER.id), '1')
    sessionStorage.setItem(
      ARRIVAL_KEY,
      JSON.stringify({
        path: 'invite',
        userId: 'someone-else',
        inviterId: 'inviter-9',
        inviterName: 'Maria Reyes',
        communityId: 'comm-1',
        communityName: 'Berkeley Community Care',
      })
    )
    render(<WelcomePage />)
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'))
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull()
  })

  it('deep-linking /welcome with no joined community redirects harmlessly to /dashboard', async () => {
    localStorage.setItem('token', 'tok')
    localStorage.setItem('user', JSON.stringify(USER))
    // no arrival context; membership lookup returns the S113 object shape with no communities
    communityService.getMyCommunities.mockResolvedValue({
      data: { communities: [], count: 0, total: 0 },
    })
    render(<WelcomePage />)
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'))
  })

  it('falls back to the first joined community when arrival context is missing (defensive getMyCommunities extraction)', async () => {
    localStorage.setItem('token', 'tok')
    localStorage.setItem('user', JSON.stringify(USER))
    communityService.getMyCommunities.mockResolvedValue({
      data: {
        communities: [{ id: 'comm-2', name: 'Oakland Tool Library' }],
        count: 1,
        total: 1,
      },
    })
    socialGraphService.getFullCommunityGraph.mockResolvedValue(RING_GRAPH)
    render(<WelcomePage />)
    expect(await screen.findByTestId('arrival-graph')).toBeInTheDocument()
    expect(screen.getAllByText(/oakland tool library/i).length).toBeGreaterThan(0)
  })

  it('graph fetch failure degrades gracefully — the CTA still works', async () => {
    seedInviteArrival()
    socialGraphService.getFullCommunityGraph.mockRejectedValue(new Error('boom'))
    render(<WelcomePage />)
    const cta = await screen.findByRole('button', { name: /see.*asks|open asks/i })
    fireEvent.click(cta)
    expect(localStorage.getItem(onboardedKeyFor(USER.id))).toBe('1')
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith(expect.stringContaining('/communities/comm-1'))
    )
  })
})

describe('WelcomeModal user-scoped gating', () => {
  it('shows for a signed-in user with no onboarded key', () => {
    render(<WelcomeModal user={USER} />)
    expect(screen.getByText(/welcome to karmyq/i)).toBeInTheDocument()
  })

  it('honors the LEGACY global key — existing users see nothing new', () => {
    localStorage.setItem('karmyq_onboarded', '1')
    render(<WelcomeModal user={USER} />)
    expect(screen.queryByText(/welcome to karmyq/i)).not.toBeInTheDocument()
  })

  it('is suppressed by the user-scoped key (written by the arrival moment)', () => {
    localStorage.setItem(onboardedKeyFor(USER.id), '1')
    render(<WelcomeModal user={USER} />)
    expect(screen.queryByText(/welcome to karmyq/i)).not.toBeInTheDocument()
  })

  it('closing writes the USER-SCOPED key', () => {
    render(<WelcomeModal user={USER} />)
    fireEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(localStorage.getItem(onboardedKeyFor(USER.id))).toBe('1')
  })
})
