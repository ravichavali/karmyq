import { answersToConfig, TrustQuestion } from '../../../apps/frontend/src/lib/answersToConfig'

const mockQuestions: TrustQuestion[] = [
  {
    id: 'q1-id',
    slug: 'new_member_warmth',
    question_text: 'How do you feel about new members?',
    display_order: 20,
    choices: [
      {
        value: 'open_arms',
        label: 'Open arms',
        display_order: 30,
        config_delta: { new_member_karma_lockout_days: 0, request_approval_required: false },
      },
      {
        value: 'trust_takes_time',
        label: 'Trust takes time',
        display_order: 10,
        config_delta: { new_member_karma_lockout_days: 14, request_approval_required: true },
      },
    ],
  },
  {
    id: 'q2-id',
    slug: 'request_curation',
    question_text: 'How do you want to curate requests?',
    display_order: 50,
    choices: [
      {
        value: 'admin_review',
        label: 'Admins review',
        display_order: 10,
        config_delta: { request_approval_required: true },
      },
      {
        value: 'trust_freely',
        label: 'Members post freely',
        display_order: 20,
        config_delta: { request_approval_required: false },
      },
    ],
  },
]

describe('answersToConfig', () => {
  it('merges config_deltas in display_order ascending', () => {
    const result = answersToConfig(mockQuestions, { 'q1-id': 'open_arms', 'q2-id': 'admin_review' })
    // q2-id (display_order 50) merges last — admin_review wins
    expect(result.request_approval_required).toBe(true)
    expect(result.new_member_karma_lockout_days).toBe(0)
  })

  it('Q6 override: request_curation overrides new_member_warmth for request_approval_required', () => {
    const result = answersToConfig(mockQuestions, { 'q1-id': 'trust_takes_time', 'q2-id': 'trust_freely' })
    // trust_freely (display_order 50) overrides trust_takes_time (display_order 20)
    expect(result.request_approval_required).toBe(false)
    expect(result.new_member_karma_lockout_days).toBe(14)
  })

  it('skips questions with no selected answer — unanswered question contributes no delta', () => {
    // Only q1 answered; q2 (request_curation) is unanswered so its override doesn't apply
    // q1 open_arms includes request_approval_required: false in its own delta
    const result = answersToConfig(mockQuestions, { 'q1-id': 'open_arms' })
    expect(result.new_member_karma_lockout_days).toBe(0)
    // open_arms sets request_approval_required: false; request_curation is skipped (no answer)
    expect(result.request_approval_required).toBe(false)
  })

  it('returns empty config when no answers given', () => {
    const result = answersToConfig(mockQuestions, {})
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('skips questions whose selected value does not match any choice', () => {
    const result = answersToConfig(mockQuestions, { 'q1-id': 'nonexistent_value' })
    expect(result.new_member_karma_lockout_days).toBeUndefined()
  })

  it('handles questions passed out of display_order — still sorts correctly', () => {
    const reversed = [...mockQuestions].reverse()
    const result = answersToConfig(reversed, { 'q1-id': 'trust_takes_time', 'q2-id': 'trust_freely' })
    // Even if array was reversed, display_order sort means q2-id (50) still wins
    expect(result.request_approval_required).toBe(false)
  })
})
