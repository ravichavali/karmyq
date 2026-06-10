/**
 * Sprint 92 — BUG-003: a service (provider-context) request reads "Offer service";
 * a mutual-aid request keeps the neighbor "Offer to Help" label on the SAME shared
 * RequestCard button. Branch on request_type === 'service' — never a blanket replace.
 */

import { render, screen } from '@testing-library/react'
import RequestCard from '@/components/Feed/RequestCard'
import type { RequestCardData } from '@/types/unified-feed'

jest.mock('@/lib/api', () => ({ requestService: { createMatch: jest.fn().mockResolvedValue({}) } }))
jest.mock('@/hooks/useTrustPath', () => ({ useTrustPath: () => ({ trustPath: null, loading: false, error: null }) }))

const card = (request_type: string): RequestCardData => ({
  id: 'req-1',
  requester_id: 'dana',
  requester_name: 'Dana',
  community_name: 'Hawthorne',
  title: 'Need help',
  description: 'desc',
  urgency: 'high',
  status: 'open',
  request_type: request_type as RequestCardData['request_type'],
  match_score: null,
  match_reason: '',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any)

describe('Sprint 92 BUG-003: provider vs neighbor offer label', () => {
  it('shows "Offer service" for a service (provider-context) request', () => {
    render(<RequestCard data={card('service')} currentUserId="helper-1" />)
    expect(screen.getByRole('button', { name: /offer service/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /offer to help/i })).toBeNull()
  })

  it('keeps "Offer to Help" for a mutual-aid (non-service) request', () => {
    render(<RequestCard data={card('generic')} currentUserId="helper-1" />)
    expect(screen.getByRole('button', { name: /offer to help/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /offer service/i })).toBeNull()
  })
})
