// tests/tdd/commitments-tab.test.ts
/**
 * Pure-logic tests for CommitmentsTab display behavior.
 * Extracts and tests the business rules for commitment categorization and badge rendering.
 */

interface Match {
  id: string
  request_id: string
  responder_id: string
  status: string
  request_title?: string
  requester_name?: string
  responder_name?: string
}

const STATUS_LABELS: Record<string, string> = {
  proposed: 'Pending',
  matched: 'Accepted',
  completed: 'Done',
  rejected: 'Declined',
  cancelled: 'Cancelled',
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

function getStatusBadgeClass(status: string): string {
  return `status-badge status-badge--${status.replace(/_/g, '-')}`
}

function splitMatches(
  allMatches: Match[],
  myRequestIds: Set<string>,
  currentUserId: string
): { helping: Match[]; requested: Match[] } {
  const helping = allMatches.filter(
    (m) => m.responder_id === currentUserId && !myRequestIds.has(m.request_id)
  )
  const requested = allMatches.filter((m) => myRequestIds.has(m.request_id))
  return { helping, requested }
}

function shouldShowMarkDone(status: string): boolean {
  return status === 'matched'
}

function shouldShowConfirmDone(status: string): boolean {
  return status === 'pending-confirmation'
}

const CURRENT_USER = 'user-me'
const MY_REQUEST_IDS = new Set(['req-1', 'req-2'])

const SAMPLE_MATCHES: Match[] = [
  { id: 'm1', request_id: 'req-3', responder_id: CURRENT_USER, status: 'matched', request_title: 'Need a ride' },
  { id: 'm2', request_id: 'req-4', responder_id: CURRENT_USER, status: 'proposed', request_title: 'Fix sink' },
  { id: 'm3', request_id: 'req-1', responder_id: 'user-other', status: 'proposed', request_title: 'My request 1' },
  { id: 'm4', request_id: 'req-2', responder_id: 'user-other2', status: 'matched', request_title: 'My request 2' },
]

describe('CommitmentsTab', () => {
  it('renders "I\'m Helping" section with correct matches', () => {
    const { helping } = splitMatches(SAMPLE_MATCHES, MY_REQUEST_IDS, CURRENT_USER)
    expect(helping).toHaveLength(2)
    expect(helping.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('renders "I Asked For Help" section with correct matches', () => {
    const { requested } = splitMatches(SAMPLE_MATCHES, MY_REQUEST_IDS, CURRENT_USER)
    expect(requested).toHaveLength(2)
    expect(requested.map((m) => m.id)).toEqual(['m3', 'm4'])
  })

  it('shows correct status label per match status', () => {
    expect(getStatusLabel('proposed')).toBe('Pending')
    expect(getStatusLabel('matched')).toBe('Accepted')
    expect(getStatusLabel('completed')).toBe('Done')
    expect(getStatusLabel('rejected')).toBe('Declined')
    expect(getStatusLabel('unknown_status')).toBe('unknown_status')
  })

  it('shows "Mark Done" button only for matched status', () => {
    expect(shouldShowMarkDone('matched')).toBe(true)
    expect(shouldShowMarkDone('proposed')).toBe(false)
    expect(shouldShowMarkDone('completed')).toBe(false)
  })

  it('shows "Confirm Done" button only for pending-confirmation status', () => {
    expect(shouldShowConfirmDone('pending-confirmation')).toBe(true)
    expect(shouldShowConfirmDone('matched')).toBe(false)
    expect(shouldShowConfirmDone('completed')).toBe(false)
  })

  it('shows empty states when no commitments', () => {
    const { helping, requested } = splitMatches([], MY_REQUEST_IDS, CURRENT_USER)
    expect(helping).toHaveLength(0)
    expect(requested).toHaveLength(0)
  })

  it('generates correct status badge CSS class', () => {
    expect(getStatusBadgeClass('proposed')).toBe('status-badge status-badge--proposed')
    expect(getStatusBadgeClass('pending-confirmation')).toBe('status-badge status-badge--pending-confirmation')
    expect(getStatusBadgeClass('in_progress')).toBe('status-badge status-badge--in-progress')
  })
})
