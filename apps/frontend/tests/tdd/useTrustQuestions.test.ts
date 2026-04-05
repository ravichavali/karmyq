/**
 * Unit tests for useTrustQuestions hook (Sprint 45)
 *
 * Tests loading, success, and error states returned by the hook.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { useTrustQuestions } from '../../src/hooks/useTrustQuestions'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/lib/api', () => ({
  trustQuestionsService: {
    list: jest.fn(),
  },
}))

// Import after mock so we get the mocked version
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { trustQuestionsService } = require('../../src/lib/api')

const MOCK_QUESTIONS = [
  { id: 'q1', slug: 'who_is_this_for', question_text: 'Who is this community for?', display_order: 10, choices: [] },
  { id: 'q2', slug: 'new_member_warmth', question_text: 'How do you feel about new members?', display_order: 20, choices: [] },
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useTrustQuestions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('starts with loading=true, empty questions, and no error', () => {
    trustQuestionsService.list.mockReturnValue(new Promise(() => {})) // never resolves

    const { result } = renderHook(() => useTrustQuestions())

    expect(result.current.loading).toBe(true)
    expect(result.current.questions).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('sets questions and loading=false on success', async () => {
    trustQuestionsService.list.mockResolvedValue({
      data: { data: { questions: MOCK_QUESTIONS } },
    })

    const { result } = renderHook(() => useTrustQuestions())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.questions).toEqual(MOCK_QUESTIONS)
    expect(result.current.error).toBeNull()
  })

  it('sets error and loading=false when list() rejects', async () => {
    trustQuestionsService.list.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useTrustQuestions())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Network error')
    expect(result.current.questions).toEqual([])
  })

  it('falls back to default message when error has no .message', async () => {
    trustQuestionsService.list.mockRejectedValue({})

    const { result } = renderHook(() => useTrustQuestions())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Failed to load questions')
  })

  it('calls trustQuestionsService.list exactly once on mount', async () => {
    trustQuestionsService.list.mockResolvedValue({
      data: { data: { questions: [] } },
    })

    const { result } = renderHook(() => useTrustQuestions())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(trustQuestionsService.list).toHaveBeenCalledTimes(1)
  })
})
