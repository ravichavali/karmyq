/**
 * Sprint 139 — the offers page (BUG-097's visible half).
 *
 * The API client's interceptor already unwraps the { success, data } envelope (src/lib/api.ts), so
 * `response.data` IS `{ offers, count, total }`. The page assigned `response.data.data` (undefined)
 * and then read `.length` on it. It also had no expiry fields, so an owner's expired active offer
 * still said "Active". These tests render the real page with only the request I/O and the app shell
 * mocked, and pin:
 *   - mount and filter changes read the unwrapped `offers` array;
 *   - an empty list shows the empty state; a failed or malformed load shows an alert + Retry
 *     (never a crash, never a fake empty list), and Retry repeats the same filters;
 *   - expiry labels: an active offer past expiry (flag OR elapsed clock) is "Expired"; an active
 *     offer with a future or NULL expiry stays "Active"; a non-active expired offer keeps its own
 *     status ("Matched") and adds "Offer expired" — never "Cancelled" or "Completed".
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockGetOffers = jest.fn()
jest.mock('@/lib/api', () => ({
  requestService: { getOffers: (...a: unknown[]) => mockGetOffers(...a) },
}))
jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import OffersPage from '@/pages/offers'

const NOW = Date.parse('2026-11-09T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const iso = (ms: number) => new Date(ms).toISOString()

type Offer = Record<string, unknown>
const offer = (over: Offer = {}): Offer => ({
  id: 'o1',
  community_id: 'c1',
  community_name: 'Maplewood',
  offerer_id: 'u1',
  helper_name: 'Ana',
  title: 'Ladder to lend',
  description: 'Six-foot ladder',
  category: 'resources',
  status: 'active',
  created_at: iso(NOW - 48 * HOUR),
  updated_at: iso(NOW - 48 * HOUR),
  expires_at: null,
  expired: false,
  ...over,
})
const page = (offers: Offer[]) => ({ data: { offers, count: offers.length, total: offers.length } })

beforeEach(() => {
  // The frontend jest config clears nothing between tests; reset explicitly.
  mockGetOffers.mockReset()
  // Fix the clock for Date.now() AND new Date(); leave every timer real so Testing Library's polling works.
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
      'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout',
    ],
  })
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('offers page: loading the unwrapped { offers, count, total } payload', () => {
  it('renders the offers from response.data.offers on mount, asking for active offers', async () => {
    mockGetOffers.mockResolvedValue(page([offer()]))
    render(<OffersPage />)
    expect(await screen.findByText('Ladder to lend')).toBeInTheDocument()
    expect(mockGetOffers).toHaveBeenCalledWith({ limit: 50, status: 'active' })
  })

  it('shows the empty state for an empty list', async () => {
    mockGetOffers.mockResolvedValue(page([]))
    render(<OffersPage />)
    expect(await screen.findByText('No offers yet')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a filter change reloads with that status and renders the new payload', async () => {
    mockGetOffers.mockResolvedValueOnce(page([offer()]))
    mockGetOffers.mockResolvedValueOnce(page([offer({ id: 'o2', title: 'Matched drill', status: 'matched' })]))
    render(<OffersPage />)
    await screen.findByText('Ladder to lend')
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'matched' } })
    expect(await screen.findByText('Matched drill')).toBeInTheDocument()
    expect(mockGetOffers).toHaveBeenLastCalledWith({ limit: 50, status: 'matched' })
  })
})

describe('offers page: failed or malformed loads', () => {
  it.each([
    ['a rejected request', () => mockGetOffers.mockRejectedValueOnce(new Error('network down'))],
    ['a payload without offers', () => mockGetOffers.mockResolvedValueOnce({ data: { count: 0 } })],
    ['a payload whose offers is not an array', () => mockGetOffers.mockResolvedValueOnce({ data: { offers: 'nope' } })],
    ['no data at all', () => mockGetOffers.mockResolvedValueOnce({})],
  ])('%s shows "Unable to load offers" with Retry — no crash, no empty-list claim', async (_l, arrange) => {
    arrange()
    render(<OffersPage />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Unable to load offers')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('No offers yet')).not.toBeInTheDocument()
  })

  it('Retry repeats the load with the same filters and then renders the offers', async () => {
    mockGetOffers.mockResolvedValueOnce(page([offer()]))
    mockGetOffers.mockRejectedValueOnce(new Error('flaky'))
    mockGetOffers.mockResolvedValueOnce(page([offer({ id: 'o3', title: 'Withdrawn saw', status: 'withdrawn' })]))
    render(<OffersPage />)
    await screen.findByText('Ladder to lend')
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'withdrawn' } })
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Withdrawn saw')).toBeInTheDocument()
    expect(mockGetOffers).toHaveBeenCalledTimes(3)
    expect(mockGetOffers.mock.calls[2][0]).toEqual({ limit: 50, status: 'withdrawn' })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})

describe('offers page: honest expiry labels', () => {
  const statusPill = async (title: string) => {
    const heading = await screen.findByText(title)
    const card = heading.closest('.kq-card') as HTMLElement
    return card
  }

  it.each([
    ['flagged expired', { expired: true, expires_at: iso(NOW + HOUR) }],
    ['elapsed clock (flag not yet set)', { expired: false, expires_at: iso(NOW - HOUR) }],
    ['elapsed clock, flag NULL', { expired: null, expires_at: iso(NOW - HOUR) }],
  ])('an active offer that is %s reads "Expired", not "Active"', async (_l, over) => {
    mockGetOffers.mockResolvedValue(page([offer(over)]))
    render(<OffersPage />)
    const card = await statusPill('Ladder to lend')
    expect(card).toHaveTextContent('Expired')
    expect(card.querySelector('[aria-label="Status: Expired"]')).not.toBeNull()
    expect(card.querySelector('[aria-label="Status: Active"]')).toBeNull()
  })

  it.each([
    ['a future expiry', { expired: false, expires_at: iso(NOW + HOUR) }],
    ['no expiry', { expired: null, expires_at: null }],
  ])('an active offer with %s stays "Active" with no expiry note', async (_l, over) => {
    mockGetOffers.mockResolvedValue(page([offer(over)]))
    render(<OffersPage />)
    const card = await statusPill('Ladder to lend')
    expect(card.querySelector('[aria-label="Status: Active"]')).not.toBeNull()
    expect(card).not.toHaveTextContent('Expired')
    expect(card).not.toHaveTextContent('Offer expired')
  })

  it('an expired MATCHED offer keeps "Matched" and adds "Offer expired" — never Cancelled or Completed', async () => {
    mockGetOffers.mockResolvedValue(page([offer({ status: 'matched', expired: true, expires_at: iso(NOW - HOUR) })]))
    render(<OffersPage />)
    const card = await statusPill('Ladder to lend')
    expect(card.querySelector('[aria-label="Status: Matched"]')).not.toBeNull()
    expect(card).toHaveTextContent('Offer expired')
    expect(card).not.toHaveTextContent('Cancelled')
    expect(card).not.toHaveTextContent('Completed')
  })
})
