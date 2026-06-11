/**
 * Sprint 93 — F1: ProviderCard shows an "in your community" badge when the API annotates
 * shared_communities for the viewer, and hides it otherwise (unauthenticated / no overlap).
 */
import { render, screen } from '@testing-library/react'
import ProviderCard, { ProviderCardData } from '@/components/providers/ProviderCard'

const base: ProviderCardData = {
  id: 'p1',
  display_name: 'Alice',
  service_type: 'tutor',
}

describe('Sprint 93 F1: ProviderCard community badge', () => {
  it('shows the shared-community badge when shared_communities is present', () => {
    render(<ProviderCard provider={{ ...base, shared_communities: [{ id: 'c1', name: 'Berkeley Community Care' }] }} />)
    expect(screen.getByText(/In Berkeley Community Care/i)).toBeInTheDocument()
  })

  it('summarizes multiple shared communities with a "+N more" suffix', () => {
    render(<ProviderCard provider={{ ...base, shared_communities: [{ id: 'c1', name: 'Berkeley' }, { id: 'c2', name: 'PDX' }] }} />)
    expect(screen.getByText(/In Berkeley \+1 more/i)).toBeInTheDocument()
  })

  it('hides the badge when there are no shared communities', () => {
    render(<ProviderCard provider={{ ...base, shared_communities: [] }} />)
    expect(screen.queryByText(/✓ In/)).toBeNull()
  })

  it('hides the badge when shared_communities is absent (unauthenticated viewer)', () => {
    render(<ProviderCard provider={base} />)
    expect(screen.queryByText(/✓ In/)).toBeNull()
  })
})
