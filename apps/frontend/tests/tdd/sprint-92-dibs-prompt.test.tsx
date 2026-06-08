/**
 * Sprint 92 — BUG-007 (Option A): DibsPrompt frames a neighbor first-ask as a
 * *neighbour*, never as a "provider." Provider (service) requests keep the
 * provider dibs framing.
 */

import { render, screen } from '@testing-library/react'
import DibsPrompt, { DibsCandidate } from '@/components/requests/DibsPrompt'

const base: Omit<DibsCandidate, 'kind'> = {
  providerUserId: 'u1',
  displayName: 'Sam',
  score: 80,
  trustScore: 60,
  priorInteractions: 2,
  trustGraphConnection: 'direct',
  trustPath: null,
}

const noop = () => {}
const asyncNoop = async () => {}

describe('Sprint 92 BUG-007: DibsPrompt neighbor vs provider framing', () => {
  it('neighbor candidate uses neighbour framing and never says "provider"', () => {
    render(
      <DibsPrompt
        candidate={{ ...base, kind: 'neighbor' }}
        requestId="r1"
        scheduledFor={null as unknown as string}
        expiresAt={new Date(Date.now() + 3600_000).toISOString()}
        onSend={asyncNoop}
        onSkip={noop}
      />
    )
    expect(screen.getByText('Ask a neighbour first?')).toBeInTheDocument()
    expect(screen.getAllByText(/neighbou?r/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/provider/i)).toBeNull()
  })

  it('provider candidate keeps the provider dibs framing', () => {
    render(
      <DibsPrompt
        candidate={{ ...base, kind: 'provider' }}
        requestId="r1"
        scheduledFor={new Date(Date.now() + 7200_000).toISOString()}
        expiresAt={new Date(Date.now() + 3600_000).toISOString()}
        onSend={asyncNoop}
        onSkip={noop}
      />
    )
    expect(screen.getByText('Offer First Dibs?')).toBeInTheDocument()
    expect(screen.getByText(/trusted provider/i)).toBeInTheDocument()
  })
})
