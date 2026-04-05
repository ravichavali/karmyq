/**
 * TDD tests for Trust Questions API (Sprint 45)
 *
 * Tests the GET /communities/trust-questions route handler:
 * - Returns questions in display_order
 * - Each question has a choices array
 * - request_curation (display_order 50) is last
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockQuery = jest.fn()

jest.mock('../../services/community-service/src/database/db', () => ({
  query: mockQuery,
  default: {},
}))

jest.mock('@karmyq/shared/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), timer: jest.fn(() => jest.fn()),
  })),
}))

// ─── Test data ────────────────────────────────────────────────────────────────

const SEEDED_QUESTIONS = [
  { id: 'q1', slug: 'who_is_this_for',    question_text: 'Who is this community for?',             display_order: 10, choices: [{ value: 'just_us', config_delta: {} }] },
  { id: 'q2', slug: 'new_member_warmth',  question_text: 'How do you feel about new members?',     display_order: 20, choices: [] },
  { id: 'q3', slug: 'relationship_style', question_text: 'What kind of relationships?',            display_order: 30, choices: [] },
  { id: 'q4', slug: 'asking_for_help',    question_text: 'How do you feel about asking for help?', display_order: 40, choices: [] },
  { id: 'q5', slug: 'generosity_memory',  question_text: 'How long should acts be remembered?',   display_order: 45, choices: [] },
  { id: 'q6', slug: 'request_curation',   question_text: 'How do you want to curate requests?',   display_order: 50,
    choices: [
      { value: 'admin_review', config_delta: { request_approval_required: true } },
      { value: 'trust_freely', config_delta: { request_approval_required: false } },
    ],
  },
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /communities/trust-questions route handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('queries the database for active questions with choices', async () => {
    mockQuery.mockResolvedValueOnce({ rows: SEEDED_QUESTIONS })

    const req: any = {}
    const res: any = { json: jest.fn() }

    // Import the router and trigger the GET / handler
    const trustQuestionsRouter = require('../../services/community-service/src/routes/trust-questions').default
    // Find the GET / route layer and call its handler
    const getLayer = trustQuestionsRouter.stack.find(
      (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
    )
    expect(getLayer).toBeDefined()

    await getLayer.route.stack[0].handle(req, res)

    expect(mockQuery).toHaveBeenCalledTimes(1)
    const sql = mockQuery.mock.calls[0][0] as string
    expect(sql).toContain('trust_questions')
    expect(sql).toContain('ORDER BY tq.display_order')
  })

  it('returns questions in display_order ascending order', async () => {
    mockQuery.mockResolvedValueOnce({ rows: SEEDED_QUESTIONS })

    const req: any = {}
    const jsonMock = jest.fn()
    const res: any = { json: jsonMock }

    const trustQuestionsRouter = require('../../services/community-service/src/routes/trust-questions').default
    const getLayer = trustQuestionsRouter.stack.find(
      (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
    )
    await getLayer.route.stack[0].handle(req, res)

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          questions: expect.arrayContaining([
            expect.objectContaining({ slug: 'who_is_this_for' }),
          ]),
        }),
      })
    )

    const questions = jsonMock.mock.calls[0][0].data.questions
    expect(questions).toHaveLength(6)

    const orders = questions.map((q: any) => q.display_order)
    const sorted = [...orders].sort((a: number, b: number) => a - b)
    expect(orders).toEqual(sorted)
  })

  it('request_curation has display_order 50 — highest of all questions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: SEEDED_QUESTIONS })

    const req: any = {}
    const jsonMock = jest.fn()
    const res: any = { json: jsonMock }

    const trustQuestionsRouter = require('../../services/community-service/src/routes/trust-questions').default
    const getLayer = trustQuestionsRouter.stack.find(
      (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
    )
    await getLayer.route.stack[0].handle(req, res)

    const questions = jsonMock.mock.calls[0][0].data.questions
    const maxOrder = Math.max(...questions.map((q: any) => q.display_order))
    const last = questions.find((q: any) => q.display_order === maxOrder)
    expect(last.slug).toBe('request_curation')
    expect(maxOrder).toBe(50)
  })

  it('each choice in request_curation has a config_delta object', async () => {
    mockQuery.mockResolvedValueOnce({ rows: SEEDED_QUESTIONS })

    const req: any = {}
    const jsonMock = jest.fn()
    const res: any = { json: jsonMock }

    const trustQuestionsRouter = require('../../services/community-service/src/routes/trust-questions').default
    const getLayer = trustQuestionsRouter.stack.find(
      (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
    )
    await getLayer.route.stack[0].handle(req, res)

    const questions = jsonMock.mock.calls[0][0].data.questions
    const curationQ = questions.find((q: any) => q.slug === 'request_curation')
    for (const choice of curationQ.choices) {
      expect(typeof choice.config_delta).toBe('object')
    }
  })
})
