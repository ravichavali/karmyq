/**
 * Sprint 80 — Layout localStorage parse guard.
 *
 * Covers the mount effect in src/components/Layout.tsx that reads
 * localStorage.user. Malformed JSON must not throw; the stale key is removed.
 */
import React from 'react'
import { render, act } from '@testing-library/react'

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), pathname: '/', query: {} }),
}))
jest.mock('@/components/NotificationBell', () => () => null)
jest.mock('@/components/ProviderNotificationBell', () => () => null)
jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({
    hasProviderProfile: false,
    isAvailable: false,
    setAvailability: jest.fn(),
    providerProfiles: [],
  }),
}))

import Layout from '@/components/Layout'

async function renderLayout() {
  await act(async () => {
    render(<Layout>child</Layout>)
  })
}

describe('Sprint 80 — Layout localStorage guard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('removes a corrupt user key instead of throwing on parse', async () => {
    localStorage.setItem('user', '{broken json')

    await expect(renderLayout()).resolves.not.toThrow()

    expect(localStorage.getItem('user')).toBeNull()
  })

  it('preserves a valid user key', async () => {
    const valid = JSON.stringify({ id: 'user-1', name: 'Ada' })
    localStorage.setItem('user', valid)

    await renderLayout()

    expect(localStorage.getItem('user')).toBe(valid)
  })

  it('does not touch storage when no user key is present', async () => {
    await renderLayout()

    expect(localStorage.getItem('user')).toBeNull()
  })
})
