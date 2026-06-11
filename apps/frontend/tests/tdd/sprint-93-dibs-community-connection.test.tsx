/**
 * Sprint 93 — DibsPrompt renders the new `community_connection` reason honestly: a
 * zero-history neighbour (admitted to the dibs pool via a community/exchange trust edge,
 * with no completed matches) must NOT be told "You've worked with them before."
 */
import { render, screen } from '@testing-library/react'
import DibsPrompt, { DibsCandidate } from '@/components/requests/DibsPrompt'

const base: Omit<DibsCandidate, 'reason'> = {
  providerUserId: 'u1',
  displayName: 'Maya',
  score: 70,
  trustScore: 55,
  priorInteractions: 0,
  trustGraphConnection: 'direct',
  trustPath: null,
  kind: 'neighbor',
}

describe('Sprint 93: DibsPrompt community_connection copy', () => {
  it('frames a zero-history neighbour as a community connection, not prior work', () => {
    render(
      <DibsPrompt
        candidate={{
          ...base,
          reason: 'community_connection',
          relationshipContext: { priorCompletedMatches: 0, lastInteractionAt: null, similarCategory: false },
        }}
        requestId="r1"
        scheduledFor={null as unknown as string}
        expiresAt={new Date(Date.now() + 3600_000).toISOString()}
        onSend={async () => {}}
        onSkip={() => {}}
      />
    )
    expect(screen.getByText(/connected with Maya in your community/i)).toBeInTheDocument()
    expect(screen.queryByText(/worked with Maya before/i)).toBeNull()
  })
})
