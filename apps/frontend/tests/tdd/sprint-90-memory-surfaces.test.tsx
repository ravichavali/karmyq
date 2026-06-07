import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import MemorySection from '../../src/components/profile/MemorySection'
import ReWarmingNudge from '../../src/components/relationships/ReWarmingNudge'
import TrustPathBadge from '../../src/components/TrustPathBadge'

// Mock the api client used by the memory surfaces.
jest.mock('../../src/lib/api', () => ({
  socialGraphService: {
    getRelationshipMemory: jest.fn(),
    getFadingRelationships: jest.fn(),
  },
}))

// next/link renders a plain anchor in tests.
jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>
})

const { socialGraphService } = require('../../src/lib/api')

const trustPath = {
  degrees_of_separation: 1,
  connection_type: 'exchange' as const,
  path: [
    { id: 'me', name: 'You' },
    { id: 'p1', name: 'Ana' },
  ],
}

describe('Sprint 90 — TrustPathBadge fades by decayTier', () => {
  it('applies the fade class + hover label for a fading bond', () => {
    const { container } = render(<TrustPathBadge compact decayTier="fading" trustPath={trustPath} />)
    const badge = container.querySelector('.kq-decay-fading')
    expect(badge).toBeTruthy()
    expect(badge?.getAttribute('title')).toMatch(/fading/i)
  })

  it('adds no fade class for a strong bond (baseline)', () => {
    const { container } = render(<TrustPathBadge compact decayTier="strong" trustPath={trustPath} />)
    expect(container.querySelector('[class*="kq-decay-"]')).toBeNull()
  })
})

describe('Sprint 90 — ReWarmingNudge', () => {
  it('renders nothing when there are no nearly-forgotten bonds', async () => {
    socialGraphService.getFadingRelationships.mockResolvedValueOnce({ data: [] })
    const { container } = render(<ReWarmingNudge communityId="c1" />)
    await waitFor(() => expect(socialGraphService.getFadingRelationships).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('renders a reconnect prompt when a nearly-forgotten bond exists', async () => {
    socialGraphService.getFadingRelationships.mockResolvedValueOnce({
      data: [
        { peerId: 'p4', peerName: 'Di', currentWeight: 0.55, decayTier: 'nearly_forgotten', lastInteractionAt: null, matchCompletedCount: 4 },
      ],
    })
    render(<ReWarmingNudge communityId="c1" />)
    expect(await screen.findByText(/Di/)).toBeInTheDocument()
    expect(screen.getByText(/reconnect before it fades/i)).toBeInTheDocument()
  })
})

describe('Sprint 90 — MemorySection', () => {
  it('shows active count + fading bonds and the let-go line', async () => {
    socialGraphService.getRelationshipMemory.mockResolvedValueOnce({
      data: {
        activeCount: 3,
        fading: [
          { peerId: 'p3', peerName: 'Cy', currentWeight: 0.8, decayTier: 'fading', lastInteractionAt: null, matchCompletedCount: 2 },
        ],
        nearlyForgotten: [],
      },
    })
    render(<MemorySection communityId="c1" />)
    expect(await screen.findByText(/3/)).toBeInTheDocument()
    expect(screen.getByText(/active/i)).toBeInTheDocument()
    expect(screen.getByText(/Cy/)).toBeInTheDocument()
    expect(screen.getByText(/What we keep/i)).toBeInTheDocument()
  })

  it('renders nothing (no empty placeholder) when there is nothing to remember', async () => {
    socialGraphService.getRelationshipMemory.mockResolvedValueOnce({
      data: { activeCount: 0, fading: [], nearlyForgotten: [] },
    })
    const { container } = render(<MemorySection communityId="c1" />)
    await waitFor(() => expect(socialGraphService.getRelationshipMemory).toHaveBeenCalled())
    await waitFor(() => expect(container.firstChild).toBeNull())
  })

  it('surfaces the re-warming nudge only when a nearly-forgotten bond exists', async () => {
    socialGraphService.getRelationshipMemory.mockResolvedValueOnce({
      data: {
        activeCount: 1,
        fading: [],
        nearlyForgotten: [
          { peerId: 'p4', peerName: 'Di', currentWeight: 0.55, decayTier: 'nearly_forgotten', lastInteractionAt: null, matchCompletedCount: 4 },
        ],
      },
    })
    render(<MemorySection communityId="c1" />)
    expect(await screen.findByText(/reconnect before it fades/i)).toBeInTheDocument()
    expect(screen.getByText(/Di/)).toBeInTheDocument()
  })
})
