/**
 * Sprint 107 — app shell clarity.
 *
 * Locks the distinction between the wide app chrome and the narrow reading/feed measure, and
 * proves the responsive overflow menu keeps primary navigation reachable.
 */

import fs from 'fs'
import path from 'path'
import { fireEvent, render, screen } from '@testing-library/react'
import Layout from '@/components/Layout'

const mockRouter = {
  pathname: '/dashboard',
  push: jest.fn(),
  back: jest.fn(),
  query: {},
}

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}))

let providerProfile = true
const setAvailability = jest.fn()

jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({
    hasProviderProfile: providerProfile,
    isAvailable: false,
    setAvailability,
    providerProfiles: providerProfile ? [{ id: 'provider-1' }] : [],
  }),
}))

jest.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    communityUnreadCount: 0,
    providerUnreadCount: 0,
    communityNotifications: [],
    providerNotifications: [],
    loading: false,
    error: null,
    markAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  }),
}))

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

beforeEach(() => {
  jest.clearAllMocks()
  providerProfile = true
  localStorage.clear()
  localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Ada' }))
})

describe('Sprint 107 app shell clarity', () => {
  it('uses a wide chrome container without widening the content measure', () => {
    const layoutSource = readSource('src/components/Layout.tsx')
    const shellCss = readSource('src/styles/karmyq-shell.css')
    const globalsCss = readSource('src/styles/globals.css')

    expect(globalsCss).toMatch(/--measure:\s*42rem/)
    expect(globalsCss).toMatch(/--measure-chrome:\s*72rem/)
    expect(layoutSource).toMatch(/className="kq-chrome-page py-4"/)
    expect(shellCss).toMatch(/\.kq-chrome-page/)
    expect(shellCss).toMatch(/max-width:\s*var\(--measure-chrome\)/)
    expect(shellCss).toMatch(/\.kq-page\s*\{[\s\S]*max-width:\s*var\(--measure\)/)
  })

  it('keeps primary nav actions reachable through the overflow menu', () => {
    render(<Layout>child</Layout>)

    expect(screen.getByRole('link', { name: 'Communities' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Service Providers|Become a provider/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /off duty|on duty/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /menu/i }))

    expect(screen.getAllByRole('link', { name: 'Communities' }).length).toBeGreaterThan(1)
    expect(screen.getAllByRole('link', { name: /Service Providers|Become a provider/ }).length).toBeGreaterThan(1)
    expect(screen.getByRole('link', { name: 'Manage my profile' })).toHaveAttribute('href', '/providers/provider-1')
    expect(screen.getAllByRole('link', { name: 'Profile' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Logout' }).length).toBeGreaterThan(1)
  })

  it('offers the provider signup path in the overflow menu for non-providers', () => {
    providerProfile = false

    render(<Layout>child</Layout>)

    fireEvent.click(screen.getByRole('button', { name: /menu/i }))

    const providerLinks = screen.getAllByRole('link', { name: 'Become a provider' })
    expect(providerLinks.length).toBeGreaterThan(1)
    expect(providerLinks[providerLinks.length - 1]).toHaveAttribute('href', '/providers/new')
    expect(screen.queryByRole('link', { name: 'Manage my profile' })).toBeNull()
  })
})
