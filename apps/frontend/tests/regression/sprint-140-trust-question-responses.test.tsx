/**
 * Sprint 140 — BUG-098: the admin trust-questions page reads the intercepted response exactly once.
 *
 * GET /communities/trust-questions answers `{ success: true, data: { questions } }`, and the API client's
 * interceptor (src/lib/api.ts) already replaces `response.data` with the envelope's `data`. The admin page read
 * `res.data.data.questions`, which threw on `undefined`, so the page showed an error instead of the questions.
 * `useTrustQuestions` already read `res.data.questions`; it is pinned here against the same boundary.
 */
import { render, screen, renderHook, waitFor } from '@testing-library/react'

const mockList = jest.fn()
jest.mock('@/lib/api', () => ({
  trustQuestionsService: { list: (...a: unknown[]) => mockList(...a) },
}))
jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
// Sprint 141 (ADR-105): the page now waits for the live platform check; this suite is about the response shape.
jest.mock('@/hooks/usePlatformAdmin', () => ({
  usePlatformAdminGate: () => true,
  usePlatformAdmin: () => ({ loading: false, platformAdmin: true }),
}))

import TrustQuestionsAdminPage from '@/pages/admin/trust-questions'
import { useTrustQuestions } from '@/hooks/useTrustQuestions'

const QUESTIONS = [
  { id: 'q1', slug: 'who_is_this_for', question_text: 'Who is this community for?', subtext: null, display_order: 10, active: true, choices: [] },
  { id: 'q2', slug: 'new_member_warmth', question_text: 'How warm are you to new members?', subtext: null, display_order: 20, active: true, choices: [] },
]
/** What `trustQuestionsService.list()` resolves with after the interceptor has unwrapped the envelope. */
const intercepted = { data: { questions: QUESTIONS } }

beforeEach(() => {
  // The frontend jest config clears nothing between tests; reset explicitly.
  mockList.mockReset()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => jest.restoreAllMocks())

describe('admin trust-questions page (BUG-098)', () => {
  it('renders every question from response.data.questions, with no error banner', async () => {
    mockList.mockResolvedValue(intercepted)
    render(<TrustQuestionsAdminPage />)
    expect(await screen.findByText('Who is this community for?')).toBeInTheDocument()
    expect(screen.getByText('How warm are you to new members?')).toBeInTheDocument()
    expect(screen.queryByText('Failed to load questions')).not.toBeInTheDocument()
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  it('a failed load still shows the server message', async () => {
    mockList.mockRejectedValue({ response: { data: { message: 'Admins only' } } })
    render(<TrustQuestionsAdminPage />)
    expect(await screen.findByText('Admins only')).toBeInTheDocument()
  })
})

describe('useTrustQuestions against the same intercepted boundary', () => {
  it('returns the questions from response.data.questions', async () => {
    mockList.mockResolvedValue(intercepted)
    const { result } = renderHook(() => useTrustQuestions())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.questions).toEqual(QUESTIONS)
    expect(result.current.error).toBeNull()
  })
})
