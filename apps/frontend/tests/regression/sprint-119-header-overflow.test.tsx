/**
 * Sprint 119 — header de-congestion lever 2 (lever 1, the wider chrome measure, shipped earlier).
 *
 * Audit finding: the congestion is xl-only — kq-topnav is hidden below xl (BUG-016) and the
 * hamburger already carries every link there. So Communities + the provider links move OUT of
 * kq-topnav and the existing overflow menu becomes the single source of link truth at every
 * viewport. My Network (Scale 1 of the belonging fractal) keeps its topnav slot.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import Layout from '@/components/Layout'

const mockRouter = { pathname: '/dashboard', push: jest.fn(), back: jest.fn(), query: {} }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

const providerState = {
  hasProviderProfile: false,
  isAvailable: false,
  setAvailability: jest.fn(),
  providerProfiles: [] as Array<{ id: string }>,
}
jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => providerState,
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

function renderLayout() {
  return render(<Layout>child</Layout>)
}

function openOverflowMenu() {
  fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
}

describe('Sprint 119 — header lever 2: overflow carries the secondary links', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Ada' }))
    mockRouter.pathname = '/dashboard'
    providerState.hasProviderProfile = false
    providerState.providerProfiles = []
  })

  it('keeps My Network in the topnav; Communities and provider links are no longer topnav links', () => {
    const { container } = renderLayout()
    const topnav = container.querySelector('.kq-topnav')!

    expect(topnav).not.toBeNull()
    expect(topnav.textContent).toContain('My Network')
    expect(topnav.textContent).not.toContain('Communities')
    expect(topnav.textContent).not.toContain('Service Providers')
    expect(topnav.textContent).not.toContain('Become a provider')
  })

  it('the overflow menu is available at every viewport (no xl:hidden gate)', () => {
    renderLayout()
    const trigger = screen.getByRole('button', { name: /open menu/i })

    expect(trigger.closest('.xl\\:hidden')).toBeNull()
  })

  it('member role reaches Communities and Become a provider in the overflow', () => {
    renderLayout()
    openOverflowMenu()

    expect(screen.getByRole('link', { name: 'Communities' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Become a provider' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Service Providers' })).toBeNull()
  })

  it('provider role reaches Service Providers and Manage my profile in the overflow', () => {
    providerState.hasProviderProfile = true
    providerState.providerProfiles = [{ id: 'provider-1' }]
    renderLayout()
    openOverflowMenu()

    expect(screen.getByRole('link', { name: 'Service Providers' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage my profile' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Communities' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Become a provider' })).toBeNull()
  })

  it('active-route highlighting survives the move into the overflow', () => {
    mockRouter.pathname = '/communities'
    renderLayout()
    openOverflowMenu()

    const communities = screen.getByRole('link', { name: 'Communities' })
    expect(communities.className).toContain('text-primary-dark')

    const network = screen.getAllByRole('link', { name: 'My Network' })
    // The topnav My Network link is NOT active on /communities.
    network.forEach(link => expect(link.className).not.toContain('text-primary-dark'))
  })

  it('keyboard/aria parity: the trigger exposes expanded state and controls the menu', () => {
    renderLayout()
    const trigger = screen.getByRole('button', { name: /open menu/i })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls', 'app-overflow-menu')

    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute('aria-expanded', 'true')
  })
})
