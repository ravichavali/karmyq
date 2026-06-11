/**
 * Sprint 93 — F1 + F3: the /providers page groups providers by shared community
 * ("In your communities") and presents a coherent provider home (My Provider Presence
 * with duty status + community framing).
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

jest.mock('@/components/Layout', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }))
jest.mock('@/components/RequestWizard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/providers/CollectiveCard', () => ({ __esModule: true, default: () => null }))
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../../src/lib/api', () => ({
  providerService: { listProviders: jest.fn(), getMyProviders: jest.fn() },
  collectiveService: { listCollectives: jest.fn(), getMyCollectives: jest.fn() },
}))

import ProvidersPage from '@/pages/providers/index'
import { providerService, collectiveService } from '../../src/lib/api'

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (k: string) => (k === 'user' ? JSON.stringify({ id: 'viewer-1', name: 'Aisha' }) : null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  })
  ;(providerService.listProviders as jest.Mock).mockResolvedValue({ data: [
    { id: 'p1', user_id: 'u1', display_name: 'Alice', service_type: 'tutor', shared_communities: [{ id: 'c1', name: 'Berkeley Community Care' }] },
    { id: 'p2', user_id: 'u2', display_name: 'Bob', service_type: 'ride', shared_communities: [] },
  ] })
  ;(providerService.getMyProviders as jest.Mock).mockResolvedValue({ data: [
    { id: 'mine', display_name: 'My Tutoring', service_type: 'tutor', is_active: true, is_available: true },
  ] })
  ;(collectiveService.getMyCollectives as jest.Mock).mockResolvedValue({ data: [] })
  ;(collectiveService.listCollectives as jest.Mock).mockResolvedValue({ data: [] })
})

describe('Sprint 93 F1+F3: provider directory grouping + coherent provider home', () => {
  it('groups providers under "In your communities" with a community badge (F1)', async () => {
    render(<ProvidersPage />)
    await waitFor(() => expect(screen.getByText('In your communities')).toBeInTheDocument())
    expect(screen.getByText('Other providers')).toBeInTheDocument()
    expect(screen.getByText(/In Berkeley Community Care/)).toBeInTheDocument()
  })

  it('shows the coherent provider home with duty status + community framing (F3)', async () => {
    render(<ProvidersPage />)
    await waitFor(() => expect(screen.getByText('My Provider Presence')).toBeInTheDocument())
    expect(screen.getByText('On duty')).toBeInTheDocument()
    expect(screen.getByText(/visible to neighbours in your communities/i)).toBeInTheDocument()
  })
})
