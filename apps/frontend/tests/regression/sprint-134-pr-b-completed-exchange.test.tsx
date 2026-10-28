/**
 * Sprint 134 PR B — rate and vouch from a completed request.
 *
 * The server lists the viewer's completed exchanges (`viewer_partners`) on GET /requests/:id and says
 * which of a partner's skills can be vouched for (`can_endorse`/`endorsed_by_me` from
 * GET /auth/skills/users/:id). The page renders a completed-exchange panel from those flags alone:
 * no client eligibility rule, and no skills/reputation call when the viewer has no partner.
 *
 * useRouter is mocked locally (custom query.id), as in the sprint-101 detail test.
 */
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'

jest.mock('next/router', () => ({
  useRouter: () => ({ query: { id: 'r1' }, replace: jest.fn(), push: jest.fn(), isReady: true }),
}))

const getRequest = jest.fn()
const getUserSkills = jest.fn()
const endorse = jest.fn()
const withdrawEndorsement = jest.fn()
const submitFeedback = jest.fn()
jest.mock('@/lib/api', () => ({
  requestService: {
    getRequest: (...args: unknown[]) => getRequest(...args),
    getRequestRelationshipContext: () => Promise.reject({ response: { status: 404 } }),
  },
  skillsService: {
    getUserSkills: (...args: unknown[]) => getUserSkills(...args),
    endorse: (...args: unknown[]) => endorse(...args),
    withdrawEndorsement: (...args: unknown[]) => withdrawEndorsement(...args),
  },
  reputationService: {
    submitFeedback: (...args: unknown[]) => submitFeedback(...args),
  },
}))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

import MemberSkills from '@/components/skills/MemberSkills'
import NotificationItem from '@/components/NotificationItem'
import RequestDetailPage from '@/pages/requests/[id]'

const COMMUNITY = 'c0ffee00-0000-4000-8000-000000000001'

const skill = (over: Record<string, unknown> = {}) => ({
  tag_id: 'tag-1', label: 'Carpentry', skill_slug: 'carpentry', endorsement_count: 0, endorsed_by_me: false, can_endorse: false, ...over,
})

const partner = (over: Record<string, unknown> = {}) => ({
  match_id: 'match-b', user_id: 'user-b', name: 'Bea', completed_at: '2026-10-28T12:00:00',
  rated_by_me: false, rating_community_id: COMMUNITY, ...over,
})

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    requester_id: 'user-r',
    title: 'Hang a ceiling fan',
    description: 'Need a hand mounting a fan.',
    status: 'completed',
    expired: false,
    urgency: 'medium',
    request_type: 'generic',
    requester_name: 'Rae',
    community_name: 'North Portland',
    payload: {},
    requirements: {},
    viewer_relation: 'own_request',
    viewer_match: null,
    ...overrides,
  }
}

/** Let MemberSkills' then/catch/finally chain settle when nothing visible changes. */
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })
const panel = () => screen.queryByRole('region', { name: 'Your completed exchange' })

beforeEach(() => {
  // Frontend Jest clears nothing between tests; reset so queued once-values cannot leak across tests.
  for (const fn of [getRequest, getUserSkills, endorse, withdrawEndorsement, submitFeedback]) fn.mockReset()
  endorse.mockResolvedValue({ data: { id: 'row-1', tag_id: 'tag-1', endorsee_id: 'user-b', created_at: '2026-10-28T00:00:00Z' } })
  submitFeedback.mockResolvedValue({ data: { score: 50 } })
})

describe('MemberSkills endorsableOnly (new mode: renders + edge cases)', () => {
  it('lists only skills the server flags as vouchable (can_endorse or endorsed_by_me)', async () => {
    getUserSkills.mockResolvedValue({ data: [
      skill({ tag_id: 'tag-1', label: 'Carpentry', can_endorse: true }),
      skill({ tag_id: 'tag-2', label: 'Cooking', can_endorse: false, endorsed_by_me: true, endorsement_count: 1 }),
      skill({ tag_id: 'tag-3', label: 'Sewing', can_endorse: false, endorsed_by_me: false, endorsement_count: 4 }),
    ] })
    render(<MemberSkills userId="user-b" endorsableOnly heading="Vouch for a skill you saw Bea use:" />)

    expect(await screen.findByText('Carpentry')).toBeInTheDocument()
    expect(screen.getByText('Cooking')).toBeInTheDocument()
    expect(screen.queryByText('Sewing')).toBeNull()
    expect(screen.getByText('Vouch for a skill you saw Bea use:')).toBeInTheDocument()
  })

  it('renders nothing while loading (no "Loading skills…")', () => {
    getUserSkills.mockReturnValue(new Promise(() => undefined))
    const { container } = render(<MemberSkills userId="user-b" endorsableOnly heading="Vouch:" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing, heading included, when no skill is vouchable (no "No shared skills")', async () => {
    getUserSkills.mockResolvedValue({ data: [skill({ can_endorse: false, endorsed_by_me: false })] })
    const { container } = render(<MemberSkills userId="user-b" endorsableOnly heading="Vouch:" />)
    await settle()
    expect(getUserSkills).toHaveBeenCalledWith('user-b')
    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    ['a hidden partner (404)', { response: { status: 404 } }],
    ['a network error', new Error('offline')],
  ])('renders nothing on %s', async (_what, failure) => {
    getUserSkills.mockRejectedValue(failure)
    const { container } = render(<MemberSkills userId="user-b" endorsableOnly heading="Vouch:" />)
    await settle()
    expect(getUserSkills).toHaveBeenCalledTimes(1)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('completed-exchange panel: shown to partners, hidden from everyone else', () => {
  it('shows the requester one block per completed helper, newest first', async () => {
    getUserSkills.mockResolvedValue({ data: [] })
    getRequest.mockResolvedValue({ data: detail({
      viewer_partners: [partner(), partner({ match_id: 'match-a', user_id: 'user-a', name: 'Ari', completed_at: '2026-10-27T12:00:00' })],
    }) })
    render(<RequestDetailPage />)

    const region = await screen.findByRole('region', { name: 'Your completed exchange' })
    expect(within(region).getAllByText(/helped with this ask\.$/).map(n => n.textContent))
      .toEqual(['Bea helped with this ask.', 'Ari helped with this ask.'])
    await waitFor(() => expect(getUserSkills).toHaveBeenCalledTimes(2))
    expect(getUserSkills.mock.calls).toEqual([['user-b'], ['user-a']])
  })

  it('shows a completed helper only the requester', async () => {
    getUserSkills.mockResolvedValue({ data: [] })
    getRequest.mockResolvedValue({ data: detail({
      requester_id: 'user-r', viewer_relation: 'not_actionable',
      viewer_partners: [partner({ match_id: 'match-v', user_id: 'user-r', name: 'Rae' })],
    }) })
    render(<RequestDetailPage />)

    const region = await screen.findByRole('region', { name: 'Your completed exchange' })
    expect(within(region).getByText('You helped Rae with this ask.')).toBeInTheDocument()
    expect(screen.getByText('This ask is completed.')).toBeInTheDocument()
  })

  it.each([
    ['an empty viewer_partners', { viewer_partners: [] }],
    ['an absent viewer_partners', {}],
  ])('renders no panel and calls no skills/reputation API for %s', async (_what, extra) => {
    getRequest.mockResolvedValue({ data: detail({ viewer_relation: 'not_actionable', ...extra }) })
    render(<RequestDetailPage />)

    expect(await screen.findByText('This ask is completed.')).toBeInTheDocument()
    await settle()
    expect(panel()).toBeNull()
    expect(screen.queryByText('Rate this exchange:')).toBeNull()
    expect(getUserSkills).not.toHaveBeenCalled()
    expect(submitFeedback).not.toHaveBeenCalled()
  })

  it('rates each unrated exchange but vouches once when one partner has two completed matches', async () => {
    getUserSkills.mockResolvedValue({ data: [skill({ can_endorse: true })] })
    getRequest.mockResolvedValue({ data: detail({
      viewer_partners: [partner(), partner({ match_id: 'match-b-old', completed_at: '2026-10-20T12:00:00' })],
    }) })
    render(<RequestDetailPage />)

    expect(await screen.findByRole('button', { name: 'Vouch for Carpentry' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Vouch for Carpentry' })).toHaveLength(1)
    expect(getUserSkills).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('Rate this exchange:')).toHaveLength(2)
  })

  it.each([
    ['already rated', { rated_by_me: true }],
    ['without a rating community', { rating_community_id: null }],
  ])('shows no rating prompt for an exchange %s', async (_what, over) => {
    getUserSkills.mockResolvedValue({ data: [] })
    getRequest.mockResolvedValue({ data: detail({ viewer_partners: [partner(over)] }) })
    render(<RequestDetailPage />)

    expect(await screen.findByText('Bea helped with this ask.')).toBeInTheDocument()
    expect(screen.queryByText('Rate this exchange:')).toBeNull()
  })
})

describe('completed-exchange panel: actions send the exact payload', () => {
  it('a 4-star rating posts the exchange, the partner and the rating community, then thanks privately', async () => {
    getUserSkills.mockResolvedValue({ data: [] })
    getRequest.mockResolvedValue({ data: detail({ viewer_partners: [partner()] }) })
    render(<RequestDetailPage />)

    const region = await screen.findByRole('region', { name: 'Your completed exchange' })
    fireEvent.click(within(region).getAllByRole('button', { name: '☆' })[3])

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1))
    expect(submitFeedback).toHaveBeenCalledWith({ match_id: 'match-b', to_user_id: 'user-b', community_id: COMMUNITY, rating: 4 })
    expect(await within(region).findByText('Thanks — ratings stay private.')).toBeInTheDocument()
    expect(within(region).queryByText('Rate this exchange:')).toBeNull()
  })

  it('Skip sends nothing and hides the prompt', async () => {
    getUserSkills.mockResolvedValue({ data: [] })
    getRequest.mockResolvedValue({ data: detail({ viewer_partners: [partner()] }) })
    render(<RequestDetailPage />)

    const region = await screen.findByRole('region', { name: 'Your completed exchange' })
    fireEvent.click(within(region).getByRole('button', { name: 'Skip' }))

    await waitFor(() => expect(within(region).queryByText('Rate this exchange:')).toBeNull())
    expect(submitFeedback).not.toHaveBeenCalled()
    expect(within(region).queryByText('Thanks — ratings stay private.')).toBeNull()
  })

  it('Vouch posts the tag id of the partner skill', async () => {
    getUserSkills.mockResolvedValue({ data: [skill({ can_endorse: true })] })
    getRequest.mockResolvedValue({ data: detail({ viewer_partners: [partner()] }) })
    render(<RequestDetailPage />)

    expect(await screen.findByText('Vouch for a skill you saw Bea use:')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Vouch for Carpentry' }))
    await waitFor(() => expect(endorse).toHaveBeenCalledWith('tag-1'))
  })
})

describe('completed-exchange panel: data fetch on mount', () => {
  it('keeps the partner sentence and rating when the skills load fails, with no vouch row or error text', async () => {
    getUserSkills.mockRejectedValue(new Error('offline'))
    getRequest.mockResolvedValue({ data: detail({ viewer_partners: [partner()] }) })
    render(<RequestDetailPage />)

    const region = await screen.findByRole('region', { name: 'Your completed exchange' })
    await waitFor(() => expect(getUserSkills).toHaveBeenCalledWith('user-b'))
    await settle()
    expect(within(region).getByText('Bea helped with this ask.')).toBeInTheDocument()
    expect(within(region).getByText('Rate this exchange:')).toBeInTheDocument()
    expect(within(region).queryByText(/Vouch for a skill/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/Could not/)).toBeNull()
  })
})

describe('completion notification CTA', () => {
  it('invites either participant to rate and vouch, not to "Rate Helper"', () => {
    render(<NotificationItem
      notification={{
        id: 'n1', user_id: 'user-b', type: 'match_completed', title: 'Exchange completed',
        body: 'Your exchange for "Hang a ceiling fan" is complete. Rate it and vouch for skills you saw.',
        data: { request_id: 'r1' }, read: false, action_url: '/requests/r1',
        created_at: '2026-10-28T12:00:00Z', read_at: null,
      }}
      onMarkAsRead={() => undefined}
      onDelete={() => undefined}
    />)
    expect(screen.getByRole('button', { name: 'Rate & vouch' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rate Helper' })).toBeNull()
  })
})

describe('completed-exchange panel: the rating outcome is honest (code review)', () => {
  it('does not thank the viewer when the rating write fails, and keeps the prompt to retry', async () => {
    getUserSkills.mockResolvedValue({ data: [] })
    submitFeedback.mockRejectedValue({ response: { status: 500 } })
    getRequest.mockResolvedValue({ data: detail({ viewer_partners: [partner()] }) })
    render(<RequestDetailPage />)

    const region = await screen.findByRole('region', { name: 'Your completed exchange' })
    fireEvent.click(within(region).getAllByRole('button', { name: '☆' })[3])

    expect(await within(region).findByText("Your rating didn't save. Try again.")).toBeInTheDocument()
    expect(within(region).queryByText('Thanks — ratings stay private.')).toBeNull()
    expect(within(region).getByText('Rate this exchange:')).toBeInTheDocument()
  })

  it('thanks the viewer when the server says this exchange is already rated (409)', async () => {
    getUserSkills.mockResolvedValue({ data: [] })
    submitFeedback.mockRejectedValue({ response: { status: 409 } })
    getRequest.mockResolvedValue({ data: detail({ viewer_partners: [partner()] }) })
    render(<RequestDetailPage />)

    const region = await screen.findByRole('region', { name: 'Your completed exchange' })
    fireEvent.click(within(region).getAllByRole('button', { name: '☆' })[3])

    expect(await within(region).findByText('Thanks — ratings stay private.')).toBeInTheDocument()
    expect(within(region).queryByText("Your rating didn't save. Try again.")).toBeNull()
  })

  it('sends one rating while the first is still saving', async () => {
    getUserSkills.mockResolvedValue({ data: [] })
    let finish!: (v: unknown) => void
    submitFeedback.mockReturnValue(new Promise(r => { finish = r }))
    getRequest.mockResolvedValue({ data: detail({ viewer_partners: [partner()] }) })
    render(<RequestDetailPage />)

    const region = await screen.findByRole('region', { name: 'Your completed exchange' })
    const stars = within(region).getAllByRole('button', { name: '☆' })
    fireEvent.click(stars[3])
    fireEvent.click(stars[4])

    expect(submitFeedback).toHaveBeenCalledTimes(1)
    expect(submitFeedback).toHaveBeenCalledWith(expect.objectContaining({ rating: 4 }))
    await act(async () => { finish({ data: { score: 50 } }) })
    expect(await within(region).findByText('Thanks — ratings stay private.')).toBeInTheDocument()
  })
})
