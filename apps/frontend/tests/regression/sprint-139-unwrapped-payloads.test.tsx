/**
 * Sprint 139 — the BUG-097 page defect, at its two other confirmed sites (scope expansion recorded in
 * the PR and handoff). The API client's response interceptor (src/lib/api.ts) already unwraps the
 * { success, data } envelope, so `response.data` IS the payload. These pages read
 * `response.data.data` (undefined):
 *   - /offers/new: GET /communities sends { communities, count, total }; the page set undefined and
 *     crashed rendering the community <select>. It is the Create Offer page the offers list links to.
 *   - /matches/[id]: GET /matches/:id sends the match row; the page read undefined.request_id and
 *     showed "Match not found" for every match.
 * The real pages render with only request I/O, the router and the app shell mocked.
 */
import { render, screen, waitFor, within } from '@testing-library/react'

const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockRouter = { query: {} as Record<string, unknown>, pathname: '/', push: mockPush, replace: mockReplace }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

const mockGetCommunities = jest.fn()
const mockGetMyCommunities = jest.fn()
const mockGetMatch = jest.fn()
jest.mock('@/lib/api', () => ({
  communityService: {
    getCommunities: (...a: unknown[]) => mockGetCommunities(...a),
    getMyCommunities: (...a: unknown[]) => mockGetMyCommunities(...a),
  },
  requestService: {
    getMatch: (...a: unknown[]) => mockGetMatch(...a),
    createOffer: jest.fn(),
  },
}))
jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import NewOfferPage from '@/pages/offers/new'
import MatchRedirectPage from '@/pages/matches/[id]'

beforeEach(() => {
  // The frontend jest config clears nothing between tests; reset explicitly.
  mockGetCommunities.mockReset()
  mockGetMyCommunities.mockReset()
  mockGetMatch.mockReset()
  mockReplace.mockReset()
  mockPush.mockReset()
  mockRouter.query = {}
  localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Ana' }))
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  localStorage.clear()
  jest.restoreAllMocks()
})

describe('/offers/new reads the unwrapped { communities, count, total }', () => {
  // Code review (Sprint 139): the picker offers the caller's OWN active communities — POST /offers refuses any
  // other — never GET /communities, which is the platform-wide discover list.
  it('lists the caller\'s own communities in the picker, never the platform-wide list', async () => {
    mockGetMyCommunities.mockResolvedValue({
      data: { communities: [{ id: 'c1', name: 'Maplewood' }, { id: 'c2', name: 'Riverside' }], count: 2, total: 2 },
    })
    render(<NewOfferPage />)
    expect(await screen.findByRole('option', { name: 'Maplewood' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Riverside' })).toBeInTheDocument()
    expect(mockGetMyCommunities).toHaveBeenCalledWith('u1')
    expect(mockGetCommunities).not.toHaveBeenCalled()
  })

  it('a malformed payload leaves an empty picker instead of crashing the page', async () => {
    mockGetMyCommunities.mockResolvedValue({ data: { count: 0 } })
    render(<NewOfferPage />)
    await waitFor(() => expect(mockGetMyCommunities).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0)) // let the rejected/odd payload land
    const picker = document.getElementById('community') as HTMLSelectElement
    expect(picker).not.toBeNull()
    expect(within(picker).getAllByRole('option').map((o) => o.textContent)).toEqual(['Select a community...'])
  })
})

describe('/matches/[id] reads the unwrapped match row', () => {
  it('redirects to the match\'s request', async () => {
    mockRouter.query = { id: 'm1' }
    mockGetMatch.mockResolvedValue({ data: { id: 'm1', request_id: 'r9', status: 'matched' } })
    render(<MatchRedirectPage />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/requests/r9'))
    expect(mockGetMatch).toHaveBeenCalledWith('m1')
    expect(screen.queryByText('Match not found')).not.toBeInTheDocument()
  })

  it('a payload without request_id is reported as not found, never a redirect to /requests/undefined', async () => {
    mockRouter.query = { id: 'm1' }
    mockGetMatch.mockResolvedValue({ data: { id: 'm1' } })
    render(<MatchRedirectPage />)
    expect(await screen.findByRole('heading', { name: 'Match not found' })).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
