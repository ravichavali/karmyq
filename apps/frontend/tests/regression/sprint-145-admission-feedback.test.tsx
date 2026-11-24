/**
 * Sprint 145 (BUG-106/108; approved D1–D3) — how the existing pages react to the admission contracts.
 *
 * - /invite/[code]: an actual acceptance still re-logs in and hands the invitation bond to /welcome.
 *   A refused acceptance (full, blocked, repeat-invitation conflict, inviter no longer active) keeps the
 *   registered account and session and routes to discovery, with no re-login and no arrival context.
 *   D1's defensive branch: an already_member no-op refreshes the session and goes to the existing
 *   community without manufacturing an invitation bond.
 * - /communities/new: a duplicate-create refusal renders the server's message and neither stores a token
 *   nor navigates; an actual join stores the supplied token and opens the community.
 *
 * Validation stays on the raw Axios envelope ({ data: { data } }); acceptance and create use the
 * unwrapping per-service client ({ data }). Only the expensive wizard children are stubbed.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockRouter = {
  query: {} as Record<string, unknown>,
  pathname: '/',
  push: jest.fn(),
  replace: jest.fn(),
}
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

jest.mock('@/lib/api', () => ({
  api: { post: jest.fn(), defaults: { headers: { common: {} } } },
  communityService: { createCommunity: jest.fn() },
  socialGraphService: { validateInvitationCode: jest.fn(), acceptInvitationCode: jest.fn() },
}))
jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/CommunityTrustQuestionnaire', () => ({
  __esModule: true,
  default: ({ onComplete }: { onComplete: (inferred: object) => void }) => (
    <button type="button" onClick={() => onComplete({})}>finish questionnaire</button>
  ),
}))
// CommunityConfigEditor is loaded through next/dynamic; the stub renders nothing.
jest.mock('next/dynamic', () => () => () => null)

const { api, communityService, socialGraphService } = require('@/lib/api')

import InvitePage from '../../src/pages/invite/[code]'
import NewCommunityPage from '../../src/pages/communities/new'

const USER = { id: 'user-145', name: 'Ines Invitee', email: 'ines@example.com' }
const INVITE_INFO = { inviter_name: 'Maria Reyes', community_name: 'Berkeley Community Care', community_id: 'comm-1' }
const ARRIVAL_KEY = 'karmyq_arrival'
const httpError = (status: number, error: string, message: string) =>
  Object.assign(new Error(message), { response: { status, data: { success: false, error, message } } })

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  mockRouter.query = {}
  mockRouter.push.mockReset()
})

describe('Sprint 145 invite landing — acceptance outcomes', () => {
  beforeEach(() => {
    mockRouter.query = { code: 'KARMYQ-S145-2026-AB12' }
    socialGraphService.validateInvitationCode.mockResolvedValue({ data: { data: INVITE_INFO } })
    api.post.mockImplementation((url: string) => {
      if (url === '/auth/register') return Promise.resolve({ data: { token: 'tok.reg', refreshToken: 'r-1', user: USER } })
      if (url === '/auth/login') {
        return Promise.resolve({ data: { token: 'tok.fresh', refreshToken: 'r-2',
          user: { ...USER, communities: [{ id: 'comm-1', name: 'Berkeley Community Care', role: 'member' }] } } })
      }
      return Promise.reject(new Error(`unexpected ${url}`))
    })
  })

  async function registerThroughInvite() {
    render(<InvitePage />)
    await screen.findAllByText(/maria reyes/i)
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: USER.name } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: USER.email } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'hunter2hunter2' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'hunter2hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: /join/i }))
  }

  it('an actual acceptance re-logs in and hands the invitation bond to /welcome', async () => {
    socialGraphService.acceptInvitationCode.mockResolvedValue({
      data: { inviter_id: 'inviter-9', community_id: 'comm-1', accepted_at: '2026-11-23T12:00:00.000Z' },
    })
    await registerThroughInvite()
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/welcome'))
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: USER.email, password: 'hunter2hunter2' })
    expect(localStorage.getItem('token')).toBe('tok.fresh')
    expect(JSON.parse(sessionStorage.getItem(ARRIVAL_KEY) || 'null')).toMatchObject({
      path: 'invite', inviterId: 'inviter-9', communityId: 'comm-1', userId: USER.id,
    })
  })

  it('D1 (defensive): an already_member no-op refreshes the session and opens the existing community with no bond', async () => {
    socialGraphService.acceptInvitationCode.mockResolvedValue({
      data: { inviter_id: 'inviter-9', community_id: 'comm-1', accepted_at: null, already_member: true },
    })
    await registerThroughInvite()
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/communities/comm-1'))
    expect(mockRouter.push).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('token')).toBe('tok.fresh')
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull()
  })

  it.each([
    [400, 'COMMUNITY_FULL', 'Community is full (Dunbar\'s number limit reached)'],
    [409, 'MEMBERSHIP_RESTORE_REQUIRES_STAFF', 'Ask a community admin to lift the block; then you can rejoin'],
    [409, 'INVITATION_CONFLICT', 'You previously joined this community through this inviter.'],
    [403, 'FORBIDDEN', 'The member who invited you is no longer active in this community'],
  ])('a refused acceptance (%i %s) keeps the account and session and routes to discovery without a bond', async (status, error, message) => {
    socialGraphService.acceptInvitationCode.mockRejectedValue(httpError(status, error, message))
    await registerThroughInvite()
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/communities?welcome=true'))
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/auth/register', expect.any(Object))
    expect(localStorage.getItem('token')).toBe('tok.reg')
    expect(JSON.parse(localStorage.getItem('user') || '{}').id).toBe(USER.id)
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull()
  })
})

describe('Sprint 145 create wizard — duplicate-create outcomes', () => {
  async function submitWizard() {
    localStorage.setItem('user', JSON.stringify(USER))
    localStorage.setItem('token', 'tok.before')
    render(<NewCommunityPage />)
    fireEvent.change(screen.getByLabelText(/community name|^name/i), { target: { value: 'Berkeley Community Care' } })
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Berkeley' } })
    fireEvent.click(screen.getByRole('button', { name: /next: configure/i }))
    fireEvent.click(await screen.findByRole('button', { name: /finish questionnaire/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^create community$/i }))
  }

  it.each([
    [409, 'CONFLICT', 'You already have a pending join request for this community'],
    [409, 'MEMBERSHIP_RESTORE_REQUIRES_STAFF', 'Ask a community admin to lift the block; then you can rejoin'],
    [409, 'MEMBERSHIP_CHANGED', 'Your membership changed before the join could be confirmed; refresh and try again'],
    [400, 'COMMUNITY_FULL', 'Community is full (Dunbar\'s number limit reached)'],
  ])('renders the server message for %i %s and neither stores a token nor navigates', async (status, error, message) => {
    communityService.createCommunity.mockRejectedValue(httpError(status, error, message))
    await submitWizard()
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBe('tok.before')
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('stores the supplied token and opens the community after an actual duplicate-create join', async () => {
    communityService.createCommunity.mockResolvedValue({
      data: { community: { id: 'comm-1', role: 'member', current_members: 13 }, existing: true, joined: true, token: 'tok.joined' },
    })
    await submitWizard()
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/communities/comm-1'))
    expect(communityService.createCommunity).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Berkeley Community Care', location: 'Berkeley',
    }))
    expect(localStorage.getItem('token')).toBe('tok.joined')
  })
})
