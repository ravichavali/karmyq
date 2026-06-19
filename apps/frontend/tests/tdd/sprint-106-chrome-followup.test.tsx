/**
 * Sprint 106 follow-up — header/chrome cleanup (post-deploy feedback):
 *  - the wordmark is the Home affordance, so the redundant "Home" nav link is gone;
 *  - provider availability is a single clickable "On duty"/"Off duty" toggle (no dashboard pill,
 *    no hamburger duplicate), shown on every viewport;
 *  - provider notifications fold into the one NotificationBell (the standalone provider bell was
 *    retired in the facelift), so a provider's unread alerts surface again.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import Layout from '@/components/Layout'
import NotificationBell from '@/components/NotificationBell'

const mockRouter = { pathname: '/dashboard', push: jest.fn(), back: jest.fn(), query: {} }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

const setAvailability = jest.fn()
let providerProfile = true
jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({
    hasProviderProfile: providerProfile,
    isAvailable: false,
    setAvailability,
    providerProfiles: [{ id: 'provider-1' }],
  }),
}))

// Notification context is overridden per-test via this mutable object.
let notifValue: any
jest.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => notifValue,
}))

const baseNotif = {
  communityNotifications: [],
  communityUnreadCount: 0,
  providerNotifications: [],
  providerUnreadCount: 0,
  loading: false,
  error: null,
  markAsRead: jest.fn(),
  deleteNotification: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  providerProfile = true
  notifValue = { ...baseNotif }
  localStorage.clear()
  localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Ada' }))
})

describe('Sprint 106 follow-up — header de-duplication', () => {
  it('drops the redundant Home nav link; the wordmark links Home', () => {
    render(<Layout>child</Layout>)
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull()
    expect(screen.getByText('Karmyq').closest('a')).toHaveAttribute('href', '/dashboard')
  })

  it('renders one clickable On duty/Off duty toggle (visible, not display:hidden)', () => {
    render(<Layout>child</Layout>)
    const toggles = screen.getAllByRole('button', { name: /off duty/i })
    // Single availability control (no hamburger duplicate rendered as a second labelled button).
    expect(toggles).toHaveLength(1)
    expect(toggles[0].className).not.toMatch(/\bhidden\b/)
    fireEvent.click(toggles[0])
    expect(setAvailability).toHaveBeenCalledWith(true)
  })
})

describe('Sprint 106 follow-up — provider notifications in the single bell', () => {
  it('reflects provider unread in the bell for a provider', () => {
    notifValue = {
      ...baseNotif,
      communityUnreadCount: 0,
      providerUnreadCount: 2,
      providerNotifications: [
        { id: 'p1', user_id: 'user-1', read: false, created_at: '2026-06-18T10:00:00Z' },
        { id: 'p2', user_id: 'user-1', read: false, created_at: '2026-06-18T11:00:00Z' },
      ],
    }
    render(<NotificationBell />)
    // Unread (from the provider stream) → "unread" aria-label + the dot renders.
    expect(screen.getByRole('button', { name: /notifications, unread/i })).toBeInTheDocument()
    expect(document.querySelector('.notification-dot')).toBeTruthy()
  })

  it('ignores the provider stream for a non-provider', () => {
    providerProfile = false
    notifValue = { ...baseNotif, communityUnreadCount: 0, providerUnreadCount: 2 }
    render(<NotificationBell />)
    expect(screen.getByRole('button', { name: /^notifications$/i })).toBeInTheDocument()
    expect(document.querySelector('.notification-dot')).toBeFalsy()
  })
})
