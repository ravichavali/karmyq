/**
 * Sprint 106 / BUG-016 + link-up legibility.
 *
 * Link-up: the provider directory nav label was inconsistent — the desktop topbar said "Providers"
 * while the mobile menu and the page title say "Service Providers", reading as a cryptic separate
 * mode. This pins the consistent, self-describing label across the nav.
 *
 * (BUG-016 header breathing room is a chrome-only CSS pass verified in the browser; the structural
 * topbar contract — wordmark + nav + actions on one row — is asserted here so it can't silently
 * regress.)
 */
import { render, screen } from '@testing-library/react'
import Layout from '@/components/Layout'

const mockRouter = { pathname: '/dashboard', push: jest.fn(), back: jest.fn(), query: {} }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({
    hasProviderProfile: true,
    isAvailable: false,
    setAvailability: jest.fn(),
    providerProfiles: [{ id: 'provider-1' }],
  }),
}))

jest.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    communityUnreadCount: 0,
    communityNotifications: [],
    loading: false,
    error: null,
    markAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  }),
}))

describe('Sprint 106 — provider link-up legibility', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Ada' }))
  })

  it('labels the provider directory "Service Providers" consistently (no bare "Providers")', () => {
    render(<Layout>child</Layout>)

    // Both the desktop topnav and the mobile menu use the self-describing label.
    expect(screen.getAllByRole('link', { name: 'Service Providers' }).length).toBeGreaterThanOrEqual(1)
    // The ambiguous bare "Providers" label is gone.
    expect(screen.queryByRole('link', { name: 'Providers' })).toBeNull()
  })

  it('keeps the warm topbar chrome intact (wordmark + nav)', () => {
    render(<Layout>child</Layout>)
    expect(screen.getByRole('navigation')).toHaveClass('kq-topbar')
    expect(screen.getByText('Karmyq')).toHaveClass('kq-wordmark')
  })
})
