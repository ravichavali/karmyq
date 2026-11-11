/**
 * Sprint 140 — BUG-099: the offers page's "All" status option.
 *
 * "All" had an empty value, so the page sent no status and the API's default (`active`) applied: "All" showed
 * only active offers. The option's value is now the explicit `all`, which the request service treats as "every
 * readable status" (the audience and expiry rules still apply server-side). The default selection stays Active.
 *
 * Only the request I/O and the app shell are mocked; the interceptor-unwrapped payload is
 * `{ offers, count, total }`, exactly what `requestService.getOffers` resolves with.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'

const mockGetOffers = jest.fn()
jest.mock('@/lib/api', () => ({
  requestService: { getOffers: (...a: unknown[]) => mockGetOffers(...a) },
}))
jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import OffersPage from '@/pages/offers'

type Offer = Record<string, unknown>
const offer = (over: Offer): Offer => ({
  community_id: 'c1',
  community_name: 'Maplewood',
  offerer_id: 'u1',
  helper_name: 'Ana',
  description: 'Fixture',
  category: 'resources',
  created_at: '2026-11-01T12:00:00.000Z',
  updated_at: '2026-11-01T12:00:00.000Z',
  expires_at: null,
  expired: false,
  ...over,
})
const page = (offers: Offer[]) => ({ data: { offers, count: offers.length, total: offers.length } })

const statusSelect = () => screen.getAllByRole('combobox')[0] as HTMLSelectElement

beforeEach(() => {
  // The frontend jest config clears nothing between tests; reset explicitly.
  mockGetOffers.mockReset()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => jest.restoreAllMocks())

describe('offers page "All" status filter (BUG-099)', () => {
  it('the All option carries the explicit value "all"; Active stays the default selection', async () => {
    mockGetOffers.mockResolvedValue(page([]))
    render(<OffersPage />)
    await screen.findByText('No offers yet')
    const all = within(statusSelect()).getByRole('option', { name: 'All' }) as HTMLOptionElement
    expect(all.value).toBe('all')
    expect(statusSelect().value).toBe('active')
    expect(mockGetOffers).toHaveBeenCalledWith({ limit: 50, status: 'active' })
  })

  it('choosing All requests status "all" and renders active, matched and withdrawn offers together', async () => {
    mockGetOffers.mockResolvedValueOnce(page([offer({ id: 'a1', title: 'Active ladder', status: 'active' })]))
    mockGetOffers.mockResolvedValueOnce(page([
      offer({ id: 'a1', title: 'Active ladder', status: 'active' }),
      offer({ id: 'm1', title: 'Matched drill', status: 'matched' }),
      offer({ id: 'w1', title: 'Withdrawn tent', status: 'withdrawn' }),
    ]))
    render(<OffersPage />)
    await screen.findByText('Active ladder')

    fireEvent.change(statusSelect(), { target: { value: 'all' } })

    expect(await screen.findByText('Matched drill')).toBeInTheDocument()
    expect(screen.getByText('Withdrawn tent')).toBeInTheDocument()
    expect(screen.getByText('Active ladder')).toBeInTheDocument()
    expect(mockGetOffers).toHaveBeenLastCalledWith({ limit: 50, status: 'all' })
    expect(mockGetOffers).toHaveBeenCalledTimes(2)
  })

  it('All combines with a category filter', async () => {
    mockGetOffers.mockResolvedValue(page([]))
    render(<OffersPage />)
    await screen.findByText('No offers yet')
    fireEvent.change(statusSelect(), { target: { value: 'all' } })
    await screen.findByText('No offers yet')
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'skills' } })
    await screen.findByText('No offers yet')
    expect(mockGetOffers).toHaveBeenLastCalledWith({ limit: 50, status: 'all', type: 'skills' })
  })
})
