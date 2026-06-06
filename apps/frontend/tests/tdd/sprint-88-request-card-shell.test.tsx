/**
 * Sprint 88 — Request card shell.
 *
 * Relationship leads, people are not rendered as scores, and match relevance becomes quiet language.
 */

import { render, screen } from '@testing-library/react'
import RequestCard from '@/components/Feed/RequestCard'
import { describeMatchSignal } from '@/utils/matchSignal'
import type { RequestCardData } from '@/types/unified-feed'

jest.mock('@/lib/api', () => ({
  requestService: {
    createMatch: jest.fn().mockResolvedValue({}),
  },
}))

jest.mock('@/hooks/useTrustPath', () => ({
  useTrustPath: () => ({
    loading: false,
    error: null,
    trustPath: {
      degrees_of_separation: 2,
      path: [
        { id: 'me', name: 'You' },
        { id: 'raj', name: 'Raj' },
        { id: 'requester-1', name: 'Aisha' },
      ],
      connection_type: 'exchange',
    },
  }),
}))

const card: RequestCardData = {
  request_id: 'req-1',
  requester_id: 'requester-1',
  title: 'Could someone bring soup tonight?',
  description: 'I am home with a fever and could use dinner for two.',
  author_name: 'Aisha',
  community_id: 'comm-1',
  community_name: 'Hawthorne Mutual Aid',
  urgency: 'medium',
  status: 'open',
  request_type: 'generic' as any,
  payload_type: undefined,
  payload: {},
  requirements: {},
  expected_duration: '20 min',
  offers_count: 0,
  match_score: 68,
  match_reason: 'close by',
  trust_degree: 2,
  requesterKarma: 120,
  requesterTrustScore: 80,
}

describe('describeMatchSignal', () => {
  it('maps numeric scores into quiet qualitative language', () => {
    expect(describeMatchSignal(82, 'close by')).toBe('strong fit · close by')
    expect(describeMatchSignal(68, 'close by')).toBe('good match · close by')
    expect(describeMatchSignal(33, null)).toBe('nearby fit')
    expect(describeMatchSignal(12, 'same community')).toBe('may still help · same community')
  })
})

describe('Sprint 88 RequestCard', () => {
  it('leads with the relationship badge before the ask', () => {
    render(<RequestCard data={card} currentUserId="helper-1" />)

    const relationship = screen.getByText(/via Raj/i)
    const ask = screen.getByRole('heading', { name: /Could someone bring soup tonight/i })

    expect(relationship.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(relationship.closest('.kq-path-badge')).toBeTruthy()
    expect(screen.getByText('R')).toHaveClass('kq-path-avatar')
  })

  it('does not render per-person score badges or leading match percentages', () => {
    render(<RequestCard data={card} currentUserId="helper-1" />)

    expect(screen.queryByText(/120/)).toBeNull()
    expect(screen.queryByText(/\d+%/)).toBeNull()
    expect(screen.getByText(/good match · close by/i)).toBeInTheDocument()
  })

  it('humanizes raw request tokens', () => {
    render(<RequestCard data={card} currentUserId="helper-1" />)

    expect(screen.queryByText('generic')).toBeNull()
    expect(screen.getByText(/Everyday help/i)).toBeInTheDocument()
  })

  it('does not invent a relationship label when requester id is missing', () => {
    render(<RequestCard data={{ ...card, requester_id: undefined }} currentUserId="helper-1" />)

    expect(screen.getByRole('heading', { name: /Could someone bring soup tonight/i })).toBeInTheDocument()
    expect(screen.queryByText(/In your community/i)).toBeNull()
  })
})
