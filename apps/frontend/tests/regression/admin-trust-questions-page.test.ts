/**
 * TDD tests for admin/trust-questions page auth gate (Sprint 45)
 *
 * Verifies that requireAdmin and isAdmin (used by the page) behave correctly:
 * - unauthenticated users → redirect to /login
 * - authenticated non-admins → redirect to /dashboard
 * - authenticated admins → allowed through (returns true)
 *
 * These tests exercise the auth-gate utilities directly. Since Sprint 141 (ADR-105) neither
 * admin/schemas nor admin/trust-questions uses them: those pages wait for the live platform check
 * (hooks/usePlatformAdmin.ts). pages/admin/founding-circle.tsx still does.
 */

import { requireAdmin, isAdmin } from '../../src/utils/admin-auth'

const mockRouter = { push: jest.fn() }

function setLocalStorage(token: string | null, user: object | null) {
  if (token !== null) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }

  if (user !== null) {
    localStorage.setItem('user', JSON.stringify(user))
  } else {
    localStorage.removeItem('user')
  }
}

describe('requireAdmin (claim-based helper; founding-circle page only since Sprint 141)', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  it('redirects to /login and returns false when not authenticated', () => {
    setLocalStorage(null, null)

    const result = requireAdmin(mockRouter)

    expect(result).toBe(false)
    expect(mockRouter.push).toHaveBeenCalledWith('/login')
  })

  it('redirects to /dashboard and returns false when authenticated but not admin', () => {
    setLocalStorage('valid-token', {
      id: 'user-1',
      email: 'user@example.com',
      communities: [{ id: 'c1', role: 'member', name: 'Test' }],
    })

    const result = requireAdmin(mockRouter)

    expect(result).toBe(false)
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
  })

  it('returns true and does not redirect when authenticated as admin', () => {
    setLocalStorage('valid-token', {
      id: 'user-1',
      email: 'admin@example.com',
      communities: [{ id: 'c1', role: 'admin', name: 'Test' }],
    })

    const result = requireAdmin(mockRouter)

    expect(result).toBe(true)
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('returns true when user is admin in any one community (multi-community)', () => {
    setLocalStorage('valid-token', {
      id: 'user-1',
      email: 'admin@example.com',
      communities: [
        { id: 'c1', role: 'member', name: 'Community A' },
        { id: 'c2', role: 'admin', name: 'Community B' },
      ],
    })

    const result = requireAdmin(mockRouter)

    expect(result).toBe(true)
    expect(mockRouter.push).not.toHaveBeenCalled()
  })
})

describe('isAdmin (controls whether page fetches questions)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns false when user is not in localStorage', () => {
    expect(isAdmin()).toBe(false)
  })

  it('returns false when user has no communities', () => {
    localStorage.setItem('token', 'tok')
    localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'x@x.com', communities: [] }))
    expect(isAdmin()).toBe(false)
  })

  it('returns true when user has admin role in at least one community', () => {
    localStorage.setItem('token', 'tok')
    localStorage.setItem('user', JSON.stringify({
      id: 'u1',
      email: 'x@x.com',
      communities: [{ id: 'c1', role: 'admin', name: 'Test' }],
    }))
    expect(isAdmin()).toBe(true)
  })
})
