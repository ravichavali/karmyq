import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DemoPage from '@/pages/demo'
import { demoService } from '@/lib/api'

jest.mock('@/lib/api', () => ({
  demoService: { startSession: jest.fn() },
}))

// Stub the panel so this test focuses on page behavior (entry, storage, story wiring).
jest.mock('@/components/relationships/RelationshipContextPanel', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="rel-panel"
      data-kind={props.kind}
      data-request={props.requestId}
      data-match={props.matchId}
      data-offer={props.offerId}
    />
  ),
}))

const mockStart = demoService.startSession as jest.Mock

const ORD_REQ = 'aaaaaaaa-0000-0000-0000-000000000001'
const ORD_MATCH = 'aaaaaaaa-0000-0000-0000-000000000002'
const PROV_REQ = 'bbbbbbbb-0000-0000-0000-000000000001'
const PROV_OFFER = 'bbbbbbbb-0000-0000-0000-000000000002'

// Minimal decodable JWT: header.payloadBase64Url.sig
function makeToken(expEpochSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ userId: 'maria', exp: expEpochSeconds }))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `x.${payload}.y`
}

function session(token: string) {
  return {
    data: {
      user: { id: 'maria', email: 'maria.reyes@test.karmyq.com', name: 'Maria Reyes', communities: [] },
      token,
      demo: {
        expiresInMinutes: 30,
        stories: [
          { kind: 'ordinary', requestId: ORD_REQ, matchId: ORD_MATCH },
          { kind: 'provider', requestId: PROV_REQ, offerId: PROV_OFFER },
        ],
      },
    },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
})

describe('Sprint 116 — guided Maria demo page (/demo)', () => {
  it('shows a read-only disclosure before entry and does not auto-start a session', () => {
    render(<DemoPage />)

    expect(screen.getByText(/read-only/i)).toBeInTheDocument()
    expect(mockStart).not.toHaveBeenCalled()
    // No story panels before entering.
    expect(screen.queryAllByTestId('rel-panel')).toHaveLength(0)
  })

  it('starts a session on "Explore" and renders both stories with the correct panel wiring', async () => {
    mockStart.mockResolvedValue(session(makeToken(Math.floor(Date.now() / 1000) + 1800)))

    render(<DemoPage />)
    fireEvent.click(screen.getByRole('button', { name: /explore/i }))

    await waitFor(() => expect(screen.getAllByTestId('rel-panel')).toHaveLength(2))

    const panels = screen.getAllByTestId('rel-panel')
    const match = panels.find((p) => p.getAttribute('data-kind') === 'match')!
    const provider = panels.find((p) => p.getAttribute('data-kind') === 'provider-offer')!
    expect(match.getAttribute('data-request')).toBe(ORD_REQ)
    expect(match.getAttribute('data-match')).toBe(ORD_MATCH)
    expect(provider.getAttribute('data-request')).toBe(PROV_REQ)
    expect(provider.getAttribute('data-offer')).toBe(PROV_OFFER)
  })

  it('stores the demo token/user/context and explicitly removes any refresh token', async () => {
    localStorage.setItem('refreshToken', 'stale-refresh')
    const token = makeToken(Math.floor(Date.now() / 1000) + 1800)
    mockStart.mockResolvedValue(session(token))

    render(<DemoPage />)
    fireEvent.click(screen.getByRole('button', { name: /explore/i }))

    await waitFor(() => expect(localStorage.getItem('token')).toBe(token))
    expect(localStorage.getItem('user')).toContain('maria.reyes@test.karmyq.com')
    expect(localStorage.getItem('demoContext')).toContain('ordinary')
    // Read-only demo sessions never carry a refresh token.
    expect(localStorage.getItem('refreshToken')).toBeNull()
  })

  it('rehydrates an existing, unexpired demo session on mount without starting a new one', async () => {
    localStorage.setItem('token', makeToken(Math.floor(Date.now() / 1000) + 1800))
    localStorage.setItem(
      'demoContext',
      JSON.stringify({
        expiresInMinutes: 30,
        stories: [
          { kind: 'ordinary', requestId: ORD_REQ, matchId: ORD_MATCH },
          { kind: 'provider', requestId: PROV_REQ, offerId: PROV_OFFER },
        ],
      })
    )

    render(<DemoPage />)

    await waitFor(() => expect(screen.getAllByTestId('rel-panel')).toHaveLength(2))
    expect(mockStart).not.toHaveBeenCalled()
  })

  it('shows an unavailable state when the session cannot be issued', async () => {
    mockStart.mockRejectedValue({ response: { status: 503 } })

    render(<DemoPage />)
    fireEvent.click(screen.getByRole('button', { name: /explore/i }))

    expect(await screen.findByText(/isn’t available|not available|unavailable/i)).toBeInTheDocument()
    // Join the Platform remains reachable even when the demo is down.
    expect(screen.getByRole('link', { name: /join the platform/i })).toBeInTheDocument()
  })

  it('always offers Join the Platform and Log in alternatives', () => {
    render(<DemoPage />)

    const join = screen.getByRole('link', { name: /join the platform/i })
    expect(join).toHaveAttribute('href', 'https://karmyq.com/register')
    expect(screen.getByRole('link', { name: /log ?in/i })).toBeInTheDocument()
  })

  it('renders no mutating controls in the active demo story', async () => {
    mockStart.mockResolvedValue(session(makeToken(Math.floor(Date.now() / 1000) + 1800)))

    render(<DemoPage />)
    fireEvent.click(screen.getByRole('button', { name: /explore/i }))
    await waitFor(() => expect(screen.getAllByTestId('rel-panel')).toHaveLength(2))

    for (const name of [/accept/i, /decline/i, /submit/i, /withdraw/i, /complete/i]) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
  })
})
