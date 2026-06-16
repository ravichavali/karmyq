import { render, screen, waitFor } from '@testing-library/react'
import MemorySection from '@/components/profile/MemorySection'
import ReWarmingNudge from '@/components/relationships/ReWarmingNudge'
import { socialGraphService } from '@/lib/api'

jest.mock('@/lib/api', () => ({
  socialGraphService: {
    getRelationshipMemory: jest.fn(),
    getFadingRelationships: jest.fn(),
  },
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

const memory = {
  activeCount: 2,
  fading: [
    {
      peerId: 'peer-fading',
      peerName: 'Maya Patel',
      currentWeight: 0.8,
      decayTier: 'fading',
      lastInteractionAt: '2026-05-01T00:00:00.000Z',
      matchCompletedCount: 2,
    },
  ],
  nearlyForgotten: [
    {
      peerId: 'peer-nearly',
      peerName: 'Sam Rivera',
      currentWeight: 0.55,
      decayTier: 'nearly_forgotten',
      lastInteractionAt: '2026-04-12T00:00:00.000Z',
      matchCompletedCount: 3,
    },
  ],
}

describe('Sprint 102 - visible profile memory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders relationship memory without requiring a karma trend', async () => {
    ;(socialGraphService.getRelationshipMemory as jest.Mock).mockResolvedValue({ data: memory })

    render(<MemorySection communityId="community-1" karmaTrend={null} />)

    expect(
      await screen.findByText((_, node) =>
        node?.tagName.toLowerCase() === 'p' &&
        node.textContent === "2 active relationships you're tending.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Maya Patel')).toBeInTheDocument()
    expect(screen.getByText(/Going quiet/i)).toBeInTheDocument()
    expect(screen.getByText(/Sam Rivera/i)).toBeInTheDocument()
    expect(screen.queryByText(/Karma trend/i)).not.toBeInTheDocument()
  })

  it('makes fading and nearly-forgotten states text-legible', async () => {
    ;(socialGraphService.getRelationshipMemory as jest.Mock).mockResolvedValue({ data: memory })

    render(<MemorySection communityId="community-1" />)

    expect(await screen.findByText(/Going quiet/i)).toBeInTheDocument()
    expect(screen.getByText(/Close to being let go/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /What we keep/i })).toHaveAttribute('href', '/about/memory')
  })

  it('suppresses hollow memory rows when there is no relationship memory', async () => {
    ;(socialGraphService.getRelationshipMemory as jest.Mock).mockResolvedValue({
      data: { activeCount: 0, fading: [], nearlyForgotten: [] },
    })

    render(<MemorySection communityId="community-1" />)

    await waitFor(() => expect(socialGraphService.getRelationshipMemory).toHaveBeenCalled())
    expect(screen.queryByLabelText(/Your memory/i)).not.toBeInTheDocument()
  })
})

describe('Sprint 102 - re-warm first step', () => {
  it('frames reconnect as optional memory care with one action', () => {
    render(
      <ReWarmingNudge
        communityId="community-1"
        relationships={[memory.nearlyForgotten[0] as any]}
      />,
    )

    expect(screen.getByText(/Close to being let go/i)).toBeInTheDocument()
    expect(screen.getByText(/Sam Rivera/)).toBeInTheDocument()
    expect(screen.getByText(/reconnect if this bond still matters/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Reconnect/i })).toHaveLength(1)
  })
})
