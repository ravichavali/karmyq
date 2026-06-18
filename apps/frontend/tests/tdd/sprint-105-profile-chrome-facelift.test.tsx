import fs from 'fs'
import path from 'path'
import { render, screen } from '@testing-library/react'
import Layout from '@/components/Layout'

const setAvailability = jest.fn()
let isAvailable = true

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/offers',
    query: {},
    push: jest.fn(),
    back: jest.fn(),
  }),
}))

jest.mock('@/components/NotificationBell', () => function NotificationBell() {
  return null
})

jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({
    hasProviderProfile: true,
    isAvailable,
    setAvailability,
    providerProfiles: [{ id: 'provider-1' }],
  }),
}))

const source = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('Sprint 105 profile and chrome facelift', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id: 'user-1', name: 'Ada' }))
    setAvailability.mockClear()
    isAvailable = true
  })

  it('renders Layout title with the warm serif heading token', () => {
    render(<Layout title="Help Offers">content</Layout>)

    expect(screen.getByRole('heading', { name: 'Help Offers' })).toHaveClass('kq-headline-sm')
  })

  it('renders provider availability as text plus accessible pressed state using semantic tokens', () => {
    render(<Layout>content</Layout>)

    const button = screen.getByRole('button', { name: /available/i })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveClass('bg-success-light', 'text-success')
    expect(button.querySelector('[aria-hidden="true"]')).toHaveClass('bg-success')
  })

  it('migrates the Profile body away from fossil card, width, and raw status colors', () => {
    const profile = source('src/pages/profile.tsx')

    expect(profile).not.toMatch(/max-w-4xl|shadow-md|bg-red-100|text-red-700|bg-gray-200|bg-gray-300|bg-gray-400|text-green-800/)
    expect((profile.match(/kq-card/g) ?? []).length).toBeGreaterThanOrEqual(5)
    expect(profile).toMatch(/className="kq-page py-8"/)
  })
})
