/**
 * Sprint 88 fidelity tightening — warm shell chrome.
 *
 * Locks the approved mockup topbar rhythm: seed-dot wordmark, Home nav, and a quiet notification dot.
 */

import { render, screen } from '@testing-library/react'
import Layout from '@/components/Layout'
import NotificationBell from '@/components/NotificationBell'

const mockRouter = {
  pathname: '/dashboard',
  push: jest.fn(),
  back: jest.fn(),
  query: {},
}

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

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
    communityUnreadCount: 7,
    communityNotifications: [],
    loading: false,
    error: null,
    markAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  }),
}))

describe('Sprint 88 shell fidelity', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Ada' }))
  })

  it('renders the warm topbar with seed wordmark and Home nav', () => {
    render(<Layout>child</Layout>)

    expect(screen.getByRole('navigation')).toHaveClass('kq-topbar')
    expect(screen.getByText('Karmyq')).toHaveClass('kq-wordmark')
    expect(document.querySelector('.kq-wordmark-seed')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('kq-topnav-link', 'active')
  })

  it('uses a quiet notification dot instead of a count badge', () => {
    const { container } = render(<NotificationBell />)

    expect(screen.getByRole('button', { name: /notifications, unread/i })).toBeInTheDocument()
    expect(screen.queryByText('7')).toBeNull()
    expect(container.querySelector('.notification-dot')).toBeTruthy()
  })
})
