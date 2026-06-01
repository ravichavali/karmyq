/**
 * Sprint 80 — Dashboard session bootstrap hardening.
 *
 * Covers the auth-bootstrap useEffect in src/pages/dashboard.tsx:
 *   - missing token            → redirect to /login, loading terminated
 *   - token present, no user   → clear auth keys, redirect, loading terminated
 *   - token + corrupt user JSON → clear all auth keys, redirect
 *   - token + user without id  → treated as invalid, clear + redirect
 *   - token + valid user       → setUser + fetchCommunities, NO redirect
 *
 * The dashboard's heavy child components / contexts are stubbed so the test
 * isolates the bootstrap branching (the only thing this sprint changed).
 */
import React from 'react'
import { render, act, screen, fireEvent, waitFor } from '@testing-library/react'

// Stable router object — returning a fresh object each call would make
// dashboard's `[router]`-keyed effect re-run forever (unmemoized-prop loop).
const mockRouter = { push: jest.fn(), query: {} as Record<string, string>, isReady: true }
jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

const mockGetMyCommunities = jest.fn().mockResolvedValue({ data: { communities: [] } })
jest.mock('@/lib/api', () => ({
  communityService: { getMyCommunities: (...args: unknown[]) => mockGetMyCommunities(...args) },
}))

jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({ hasProviderProfile: false, isAvailable: false, providerServiceTypes: [] }),
}))
jest.mock('@/hooks/useOnboarding', () => ({
  useOnboarding: () => ({ shouldShow: false, markSeen: jest.fn() }),
}))

// Stub heavy children — irrelevant to bootstrap branching.
jest.mock('@/components/Layout', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>)
jest.mock('@/components/WelcomeModal', () => () => null)
jest.mock('@/components/TabBar', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/BrowseFeed', () => () => null)
jest.mock('@/components/CommitmentsTab', () => () => null)
jest.mock('@/components/MyRequestsTab', () => () => null)
jest.mock('@/components/SpeedDialFab', () => () => null)
jest.mock('@/components/RequestWizard', () => () => null)
jest.mock('@/components/OnboardingOverlay', () => () => null)

import Dashboard from '@/pages/dashboard'

async function mountDashboard() {
  await act(async () => {
    render(<Dashboard />)
  })
}

describe('Sprint 80 — Dashboard session bootstrap', () => {
  beforeEach(() => {
    localStorage.clear()
    mockRouter.push.mockClear()
    mockGetMyCommunities.mockClear()
    // jsdom does not implement scrollTo; dashboard's scroll-on-tab effect calls it.
    window.scrollTo = jest.fn()
  })

  it('redirects to /login when no token is present', async () => {
    await mountDashboard()
    expect(mockRouter.push).toHaveBeenCalledWith('/login')
    expect(mockGetMyCommunities).not.toHaveBeenCalled()
  })

  it('clears token/refreshToken and redirects when token exists but user is missing', async () => {
    localStorage.setItem('token', 'jwt')
    localStorage.setItem('refreshToken', 'refresh')

    await mountDashboard()

    expect(mockRouter.push).toHaveBeenCalledWith('/login')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(mockGetMyCommunities).not.toHaveBeenCalled()
  })

  it('clears all auth keys and redirects when user JSON is corrupt', async () => {
    localStorage.setItem('token', 'jwt')
    localStorage.setItem('refreshToken', 'refresh')
    localStorage.setItem('user', '{not valid json')

    await mountDashboard()

    expect(mockRouter.push).toHaveBeenCalledWith('/login')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(mockGetMyCommunities).not.toHaveBeenCalled()
  })

  it('treats a user object without an id as an invalid session', async () => {
    localStorage.setItem('token', 'jwt')
    localStorage.setItem('user', JSON.stringify({ name: 'No Id' }))

    await mountDashboard()

    expect(mockRouter.push).toHaveBeenCalledWith('/login')
    expect(localStorage.getItem('user')).toBeNull()
    expect(mockGetMyCommunities).not.toHaveBeenCalled()
  })

  it('keeps the session and fetches communities for a valid user', async () => {
    localStorage.setItem('token', 'jwt')
    localStorage.setItem('user', JSON.stringify({ id: 'user-123', name: 'Ada' }))

    await mountDashboard()

    expect(mockRouter.push).not.toHaveBeenCalled()
    expect(mockGetMyCommunities).toHaveBeenCalledWith('user-123')
    // Valid session leaves auth storage intact.
    expect(localStorage.getItem('token')).toBe('jwt')
    expect(localStorage.getItem('user')).not.toBeNull()
  })

  it('shows a retry banner when community load fails and retries on click', async () => {
    localStorage.setItem('token', 'jwt')
    localStorage.setItem('user', JSON.stringify({ id: 'user-123', name: 'Ada' }))
    mockGetMyCommunities
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ data: { communities: [] } })

    await mountDashboard()

    expect(screen.getByText('We could not load your communities. You can retry now.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(mockGetMyCommunities).toHaveBeenCalledTimes(2))
  })
})
