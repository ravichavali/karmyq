/**
 * Sprint 140 — BUG-098: messaging consumers read the intercepted response exactly once.
 *
 * Messaging service answers `{ success: true, data: <payload> }`: GET /conversations → an array of conversations,
 * GET /conversations/:id → the conversation, GET /conversations/:id/messages → an array of messages,
 * POST /conversations → the new conversation, GET /match/:matchId → `{ conversation_id, messages }`. The API
 * client's interceptor already replaced `response.data` with that payload, but MessagingContext, InlineChat and
 * FloatingChat read `response.data.data` — undefined — so the conversation list, the open conversation, its messages,
 * a newly created conversation, the inline chat's conversation id and the floating unread total were all lost.
 *
 * Three lookalikes are NOT defects and must stay as they are, because their client never runs the interceptor:
 * the invite page (raw axios), the token-refresh fallback (raw axios) and useMessaging's REST fallback (raw fetch).
 */
import fs from 'fs'
import path from 'path'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const mockGetConversations = jest.fn()
const mockGetConversation = jest.fn()
const mockGetMessages = jest.fn()
const mockCreateConversation = jest.fn()
const mockGetMatchConversation = jest.fn()
jest.mock('@/lib/api', () => ({
  messagingService: {
    getConversations: (...a: unknown[]) => mockGetConversations(...a),
    getConversation: (...a: unknown[]) => mockGetConversation(...a),
    getMessages: (...a: unknown[]) => mockGetMessages(...a),
    createConversation: (...a: unknown[]) => mockCreateConversation(...a),
    getMatchConversation: (...a: unknown[]) => mockGetMatchConversation(...a),
    getSocketUrl: () => 'http://messaging.test',
  },
}))

const mockSocket = { on: jest.fn(), off: jest.fn(), emit: jest.fn(), close: jest.fn(), disconnect: jest.fn() }
jest.mock('socket.io-client', () => ({ io: () => mockSocket }))

const mockUseMessaging = jest.fn()
jest.mock('@/hooks/useMessaging', () => ({ useMessaging: (opts: unknown) => mockUseMessaging(opts) }))

import { MessagingProvider, useMessaging as useMessagingContext } from '@/contexts/MessagingContext'
import InlineChat from '@/components/InlineChat'
import FloatingChat from '@/components/FloatingChat'

const CONVERSATIONS = [
  { id: 'c1', match_id: 'm1', last_message: 'See you at 5', last_message_at: '2026-11-09T10:00:00Z', unread_count: 2, other_user_name: 'Bea' },
  { id: 'c2', match_id: 'm2', last_message: null, last_message_at: '2026-11-08T10:00:00Z', unread_count: 3, other_user_name: 'Cal' },
]
const MESSAGES = [
  { id: 'msg1', conversation_id: 'c1', sender_id: 'u2', content: 'Hello there', created_at: '2026-11-09T09:00:00Z' },
  { id: 'msg2', conversation_id: 'c1', sender_id: 'u1', content: 'Hi Bea', created_at: '2026-11-09T09:01:00Z' },
]

beforeEach(() => {
  // The frontend jest config clears nothing between tests; reset explicitly.
  for (const m of [mockGetConversations, mockGetConversation, mockGetMessages, mockCreateConversation, mockGetMatchConversation, mockUseMessaging]) m.mockReset()
  for (const fn of Object.values(mockSocket)) fn.mockReset()
  localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Ana' }))
  localStorage.setItem('token', 'jwt-token')
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  mockUseMessaging.mockReturnValue({
    messages: [], loading: false, connected: false, sendMessage: jest.fn(), refreshMessages: jest.fn(),
    startTyping: jest.fn(), stopTyping: jest.fn(), isTyping: false, typingUser: null,
  })
})
afterEach(() => {
  localStorage.clear()
  jest.restoreAllMocks()
})

/** Renders the context's state so the test reads what a consumer would see. */
let ctx: ReturnType<typeof useMessagingContext>
function Probe() {
  ctx = useMessagingContext()
  return (
    <div>
      <p data-testid="conversations">{JSON.stringify((ctx.conversations ?? null) && ctx.conversations.map((c) => c.id))}</p>
      <p data-testid="current">{ctx.currentConversation?.id ?? 'none'}</p>
      <p data-testid="messages">{JSON.stringify((ctx.messages ?? null) && ctx.messages.map((m) => m.content))}</p>
      <p data-testid="error">{ctx.error ?? ''}</p>
    </div>
  )
}
const text = (id: string) => screen.getByTestId(id).textContent

describe('MessagingContext (BUG-098)', () => {
  beforeEach(() => {
    mockGetConversations.mockResolvedValue({ data: CONVERSATIONS })
  })

  it('loads the conversation list from response.data', async () => {
    render(<MessagingProvider><Probe /></MessagingProvider>)
    await waitFor(() => expect(text('conversations')).toBe('["c1","c2"]'))
    expect(text('error')).toBe('')
  })

  it('selecting a conversation sets it and its messages from response.data', async () => {
    mockGetConversation.mockResolvedValue({ data: CONVERSATIONS[0] })
    mockGetMessages.mockResolvedValue({ data: MESSAGES })
    render(<MessagingProvider><Probe /></MessagingProvider>)
    await waitFor(() => expect(text('conversations')).toBe('["c1","c2"]'))

    await act(async () => { await ctx.selectConversation('c1') })

    expect(text('current')).toBe('c1')
    expect(text('messages')).toBe('["Hello there","Hi Bea"]')
    expect(mockGetMessages).toHaveBeenCalledWith('c1', { limit: 50 })
    expect(mockSocket.emit).toHaveBeenCalledWith('join_conversation', 'c1')
    expect(text('error')).toBe('')
  })

  it('creating a conversation returns it and puts it first in the list', async () => {
    const created = { id: 'c3', match_id: 'm9', last_message: null, last_message_at: '2026-11-10T10:00:00Z', unread_count: 0, other_user_name: 'Dee' }
    mockCreateConversation.mockResolvedValue({ data: created })
    render(<MessagingProvider><Probe /></MessagingProvider>)
    await waitFor(() => expect(text('conversations')).toBe('["c1","c2"]'))

    let returned: unknown
    await act(async () => { returned = await ctx.createConversation('m9', ['u1', 'u4']) })

    expect(returned).toEqual(created)
    expect(text('conversations')).toBe('["c3","c1","c2"]')
  })
})

describe('InlineChat (BUG-098)', () => {
  it('expanding fetches the match conversation and hands its id to the messaging hook', async () => {
    mockGetMatchConversation.mockResolvedValue({ data: { conversation_id: 'conv-9', messages: [] } })
    render(<InlineChat matchId="m1" currentUserId="u1" isRequester matchStatus="matched" otherParticipantName="Bea" />)

    fireEvent.click(screen.getByRole('button', { name: /Chat with Bea/ }))

    await waitFor(() => expect(mockUseMessaging).toHaveBeenLastCalledWith({ matchId: 'm1', conversationId: 'conv-9', enabled: true }))
    expect(mockGetMatchConversation).toHaveBeenCalledWith('m1')
  })
})

describe('FloatingChat (BUG-098)', () => {
  it('opening lists the conversations from response.data and totals their unread counts', async () => {
    mockGetConversations.mockResolvedValue({ data: CONVERSATIONS })
    render(<FloatingChat />)

    fireEvent.click(screen.getByRole('button', { name: 'Open messages' }))

    expect(await screen.findByText('Bea')).toBeInTheDocument()
    expect(screen.getByText('Cal')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // 2 + 3 unread
    expect(screen.queryByText('When you help someone or get help, you\'ll see conversations here')).not.toBeInTheDocument()
  })
})

describe('raw-client lookalikes keep their double read (they bypass the interceptor)', () => {
  const src = (rel: string) => fs.readFileSync(path.join(__dirname, '../../src', rel), 'utf8')

  it('invite page: validateInvitationCode is a raw axios call, so the page reads response.data.data', () => {
    expect(src('lib/api.ts')).toMatch(/validateInvitationCode: \(invitationCode: string\) =>\s+axios\.get\(/)
    expect(src('pages/invite/[code].tsx')).toContain('setInvitationInfo(response.data.data);')
  })

  it('token refresh: the fallback posts with raw axios and reads the envelope itself', () => {
    expect(src('lib/api.ts')).toMatch(
      /const response = await axios\.post\(`\$\{AUTH_API_URL\}\/auth\/refresh`[\s\S]{0,120}?response\.data\.data \?\? response\.data/)
  })

  it('useMessaging REST fallback: raw fetch, so it reads data.data.messages', () => {
    const hook = src('hooks/useMessaging.ts')
    expect(hook).toMatch(/const response = await fetch\(\s+`\$\{MESSAGING_SERVICE_URL\}\/match\/\$\{matchId\}`/)
    expect(hook).toContain('setMessages(data.data.messages || [])')
  })
})
