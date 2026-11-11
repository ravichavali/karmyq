/**
 * Sprint 140 — BUG-098 at the real boundary.
 *
 * The component tests (sprint-140-*-responses) mock `@/lib/api` with what the client returns AFTER its interceptor.
 * This file pins that premise against the REAL `src/lib/api.ts`: each per-service axios instance gets a stub adapter
 * that answers with the raw server envelope `{ success: true, data }`, exactly as the services send it, and the test
 * asserts what the service wrapper resolves with. If the interceptor stopped unwrapping, these fail.
 *
 * It also pins the three lookalikes that bypass the interceptor, by behaviour where the client allows it:
 * `validateInvitationCode` is raw axios (the envelope comes back whole, so the invite page's `response.data.data` is
 * right), and useMessaging's REST fallback is raw fetch (so `data.data.messages` is right). The token-refresh fallback
 * runs inside the error interceptor, so it stays a source pin.
 */
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { renderHook, act } from '@testing-library/react'

jest.mock('socket.io-client', () => ({ io: () => ({ on: jest.fn(), off: jest.fn(), emit: jest.fn(), close: jest.fn(), disconnect: jest.fn() }) }))

import { api, communityApi, messagingApi, trustQuestionsService, userSettingsService, messagingService, socialGraphService } from '@/lib/api'
import { useMessaging } from '@/hooks/useMessaging'

type Instance = { defaults: { adapter?: unknown } }
/** Answer every request on `client` with the raw server body `body` (status 200), recording the requested URLs. */
function serve(client: Instance, body: unknown) {
  const urls: string[] = []
  client.defaults.adapter = async (config: { url?: string }) => {
    urls.push(String(config.url))
    return { data: body, status: 200, statusText: 'OK', headers: {}, config }
  }
  return urls
}

const envelope = <T>(data: T) => ({ success: true, data })
const originals = new Map<Instance, unknown>()
beforeEach(() => {
  for (const c of [api, communityApi, messagingApi, axios] as unknown as Instance[]) originals.set(c, c.defaults.adapter)
  localStorage.setItem('token', 'jwt-token')
})
afterEach(() => {
  for (const [c, adapter] of originals) c.defaults.adapter = adapter
  localStorage.clear()
  jest.restoreAllMocks()
})

describe('interceptor-backed clients resolve with the payload, unwrapped exactly once', () => {
  it('trust questions: response.data is { questions }', async () => {
    const questions = [{ id: 'q1', slug: 'who_is_this_for', question_text: 'Who?', display_order: 10, choices: [] }]
    serve(communityApi as unknown as Instance, envelope({ questions }))
    const res = await trustQuestionsService.list()
    expect(res.data).toEqual({ questions })
    expect(res.data.data).toBeUndefined()
  })

  it('preferences, interests and add-interest: response.data is the auth payload', async () => {
    const urls = serve(api as unknown as Instance, envelope({ preferences: [{ request_type: 'ride', subscribed: false }], isDefault: false }))
    expect((await userSettingsService.getRequestTypePreferences()).data.preferences).toEqual([{ request_type: 'ride', subscribed: false }])

    serve(api as unknown as Instance, envelope({ interests: [{ id: 'i1' }], grouped: {}, count: 1 }))
    expect((await userSettingsService.getInterests()).data.interests).toEqual([{ id: 'i1' }])

    serve(api as unknown as Instance, envelope({ id: 'i2', interest_type: 'service_category', interest_value: 'tutoring', isNew: true }))
    const added = await userSettingsService.addInterest({ interest_type: 'service_category', interest_value: 'tutoring' })
    expect({ isNew: added.data.isNew, id: added.data.id }).toEqual({ isNew: true, id: 'i2' })
    expect(urls).toEqual(['/preferences/request-types'])
  })

  it('messaging: conversations are the array itself; the match conversation is { conversation_id, messages }', async () => {
    const conversations = [{ id: 'c1' }, { id: 'c2' }]
    serve(messagingApi as unknown as Instance, envelope(conversations))
    expect((await messagingService.getConversations()).data).toEqual(conversations)

    serve(messagingApi as unknown as Instance, envelope({ conversation_id: 'conv-9', messages: [] }))
    expect((await messagingService.getMatchConversation('m1')).data.conversation_id).toBe('conv-9')
  })
})

describe('lookalikes that bypass the interceptor keep their own double read', () => {
  it('validateInvitationCode is raw axios: the envelope comes back whole, so response.data.data is the payload', async () => {
    const info = { community_name: 'Maplewood', inviter_name: 'Ana' }
    serve(axios as unknown as Instance, envelope(info))
    const res = await socialGraphService.validateInvitationCode('ABC123')
    expect(res.data).toEqual({ success: true, data: info })
    expect(res.data.data).toEqual(info)
  })

  it('useMessaging REST fallback is raw fetch: it reads data.data.messages from the envelope', async () => {
    const messages = [{ id: 'msg1', content: 'Hello', sender_id: 'u2', created_at: '2026-11-09T09:00:00Z' }]
    const fetchSpy = jest.fn().mockResolvedValue({ ok: true, json: async () => envelope({ conversation_id: 'conv-9', messages }) })
    global.fetch = fetchSpy as unknown as typeof fetch
    const { result } = renderHook(() => useMessaging({ matchId: 'm1', conversationId: null, enabled: false }))
    await act(async () => { await result.current.refreshMessages() })
    expect(result.current.messages).toEqual(messages)
    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/match\/m1$/)
  })

  it('token-refresh fallback posts with raw axios and reads the envelope itself (source pin: it runs in the error interceptor)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../src/lib/api.ts'), 'utf8')
    expect(src).toMatch(
      /const response = await axios\.post\(`\$\{AUTH_API_URL\}\/auth\/refresh`, \{\s+refreshToken: storedRefreshToken,\s+\}\)\s+const \{ token: newToken, refreshToken: newRefreshToken \} = response\.data\.data \?\? response\.data/)
  })
})
