/**
 * Sprint 120 PR C — the maintainer-selected five-second-clarity fixes (R-1 … R-8).
 *
 * Each block below pins one finding from
 * docs/superpowers/research/2026-07-16-sprint-120-five-second-audit.md:
 *   R-1 (F-2)  UTF-8-safe JWT payload decode — em dashes in community names stop mojibaking
 *   R-2 (F-3)  the dashboard community <select> can no longer set the page width at 375px
 *   R-3 (F-8)  the logged-out app root links the /demo tour
 *   R-4 (F-7)  /login and /register carry the brand and a route home
 *   R-5 (ref)  the create action is labelled, not a bare "+"
 *   R-6 (F-1)  the welcome modal and a workflow tour never stack on one visit
 *   R-7 (F-5)  a sparse ego graph offers the next step instead of an empty canvas
 *   R-8 (F-6)  the active /network mode pill uses the green primary, not indigo
 */
import React from 'react'
import { render, screen, waitFor, act, within, fireEvent } from '@testing-library/react'
import { renderHook } from '@testing-library/react'

// ---------------------------------------------------------------- shared mocks

jest.mock('next/router', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    query: {} as Record<string, unknown>,
    isReady: true,
    pathname: '/',
    asPath: '/',
    events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  }
  return { useRouter: () => router }
})

jest.mock('next/link', () => {
  // Spread the rest of the props — dropping them would swallow data-testid and make an assertion
  // about a real rendered link silently unfindable.
  const MockLink = ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  )
  MockLink.displayName = 'MockLink'
  return MockLink
})

// The real hook implementation runs; the wrapper only makes the call arguments assertable, so the
// dashboard's suppression wiring can be checked without stubbing the logic under test.
jest.mock('@/hooks/useOnboarding', () => {
  const actual = jest.requireActual('@/hooks/useOnboarding')
  return { useOnboarding: jest.fn(actual.useOnboarding) }
})

jest.mock('@/lib/api', () => ({
  api: { post: jest.fn() },
  communityService: {
    getMyCommunities: jest.fn().mockResolvedValue({
      data: {
        communities: [{ id: 'c1', name: 'Southeast PDX Helpers — Group B — Group B' }],
        count: 1,
        total: 1,
      },
    }),
  },
  socialGraphService: {
    getNeighborhood: jest.fn().mockResolvedValue({ data: { nodes: [], links: [] } }),
    getFullCommunityGraph: jest.fn().mockResolvedValue({ data: { nodes: [], links: [] } }),
    getCommunityGraph: jest.fn().mockResolvedValue({ data: { nodes: [], links: [] } }),
  },
}))

jest.mock('@/contexts/ProviderContext', () => ({
  useProvider: () => ({ hasProviderProfile: false, isAvailable: false, providerServiceTypes: [] }),
}))

jest.mock('@/components/Layout', () => {
  const MockLayout = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  MockLayout.displayName = 'MockLayout'
  return MockLayout
})
jest.mock('@/components/BelongingGraph', () => {
  const MockGraph = () => <div data-testid="belonging-graph" />
  MockGraph.displayName = 'MockGraph'
  return MockGraph
})
jest.mock('@/components/Feed/UnifiedFeed', () => {
  const MockFeed = () => <div data-testid="feed" />
  MockFeed.displayName = 'MockFeed'
  return MockFeed
})
jest.mock('@/components/TabBar', () => {
  const MockTabBar = () => <div data-testid="tabbar" />
  MockTabBar.displayName = 'MockTabBar'
  return MockTabBar
})
jest.mock('@/components/RequestWizard', () => {
  const MockWizard = () => null
  MockWizard.displayName = 'MockWizard'
  return MockWizard
})

const signedInUser = { id: 'user-1', name: 'Maria Reyes' }

function signIn() {
  localStorage.setItem('token', 'token')
  localStorage.setItem('user', JSON.stringify(signedInUser))
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

// ---------------------------------------------------------------- R-1

describe('R-1 · JWT payloads decode as UTF-8 (BUG-032)', () => {
  // A real community name from the demo: the em dash is U+2014, three bytes in UTF-8.
  const COMMUNITY_NAME = 'Southeast PDX Helpers — Group B'

  function makeToken(payload: unknown): string {
    const json = JSON.stringify(payload)
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    bytes.forEach((b) => { binary += String.fromCharCode(b) })
    // base64url, as issued by the auth service
    return `header.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.sig`
  }

  it('returns the em dash unchanged instead of Latin-1 mojibake', () => {
    const { decodeJwtPayload } = require('@/lib/jwt')
    const token = makeToken({ userId: 'u1', communities: [{ id: 'c1', name: COMMUNITY_NAME }] })

    const payload = decodeJwtPayload(token)

    expect(payload.communities[0].name).toBe(COMMUNITY_NAME)
    expect(payload.communities[0].name).not.toContain('â')
  })

  it('decodes non-Latin scripts and accents', () => {
    const { decodeJwtPayload } = require('@/lib/jwt')
    const token = makeToken({ email: 'jose@test.karmyq.com', name: 'José Álvarez · 東京の隣人' })

    expect(decodeJwtPayload(token).name).toBe('José Álvarez · 東京の隣人')
  })

  it('handles both base64url substitutions, proven on a payload that needs each one', () => {
    const { decodeJwtPayload } = require('@/lib/jwt')
    // '>' and '?' next to the two-byte U+00FF (C3 BF) align the 6-bit groups so standard base64
    // emits BOTH '+' (62) and '/' (63), which base64url replaces with '-' and '_'. The two asserts
    // below keep this a proof: if a future edit changes the payload and loses either character, the
    // test fails instead of silently covering only one substitution.
    const payload = { a: '?ÿ>', b: 'ÿ?>' }
    const segment = makeToken(payload).split('.')[1]

    expect(segment).toMatch(/-/)
    expect(segment).toMatch(/_/)
    expect(decodeJwtPayload(makeToken(payload))).toEqual(payload)
  })

  it('returns null for a malformed token rather than throwing', () => {
    const { decodeJwtPayload } = require('@/lib/jwt')

    expect(decodeJwtPayload('not-a-token')).toBeNull()
    expect(decodeJwtPayload('a.!!!not-base64!!!.c')).toBeNull()
  })

  it('returns null for invalid UTF-8 rather than smuggling U+FFFD into a valid-looking payload', () => {
    const { decodeJwtPayload } = require('@/lib/jwt')
    // A lone 0x80 continuation byte inside an otherwise well-formed JSON string. Non-fatal decoding
    // would yield {"name":"a�"} — parseable, and silently wrong.
    const bytes = [...'{"name":"a'].map((c) => c.charCodeAt(0)).concat([0x80, 0x22, 0x7d])
    const binary = String.fromCharCode(...bytes)
    const token = `header.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.sig`

    expect(decodeJwtPayload(token)).toBeNull()
  })
})

// ---------------------------------------------------------------- R-2

describe('R-2 · the dashboard community selector cannot widen the page (F-3)', () => {
  it('constrains the select and gives it a min-w-0 parent', async () => {
    signIn()
    const Dashboard = require('@/pages/dashboard').default

    render(<Dashboard />)

    const select = await screen.findByRole('combobox')
    // A long option ("Southeast PDX Helpers — Group B — Group B") otherwise sets the
    // intrinsic width and pushes the document to 470px inside a 360px viewport.
    expect(select.className).toContain('max-w-full')
    expect(select.parentElement?.className).toContain('min-w-0')
  })
})

// ---------------------------------------------------------------- R-3

describe('R-3 · the app root points cold visitors at the /demo tour (F-8)', () => {
  it('offers the tour alongside Get started / Log in when logged out', () => {
    const Home = require('@/pages/index').default

    render(<Home />)

    const demoLink = screen.getByRole('link', { name: /how it works|tour|demo/i })
    expect(demoLink).toHaveAttribute('href', '/demo')
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/register')
  })

  it('does not offer the tour to a signed-in visitor', async () => {
    signIn()
    const Home = require('@/pages/index').default

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /go to your dashboard/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: /how it works|tour|demo/i })).toBeNull()
  })
})

// ---------------------------------------------------------------- R-4

describe('R-4 · the auth pages carry the brand and a route home (F-7)', () => {
  it('login shows the wordmark linking / above the form', () => {
    const Login = require('@/pages/login').default

    render(<Login />)

    expect(screen.getByRole('link', { name: /karmyq/i })).toHaveAttribute('href', '/')
    expect(screen.getByText(/trust, not transactions/i)).toBeInTheDocument()
  })

  it('register shows the wordmark linking / above the form', () => {
    const Register = require('@/pages/register').default

    render(<Register />)

    expect(screen.getByRole('link', { name: /karmyq/i })).toHaveAttribute('href', '/')
    expect(screen.getByText(/trust, not transactions/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------- R-5

describe('R-5 · the create action is labelled AND does not overlay the feed at 375px', () => {
  const SpeedDialFab = () => require('@/components/SpeedDialFab').default

  it('labels the mobile create action, in a docked full-width bar (not a floating corner FAB)', () => {
    const Fab = SpeedDialFab()
    render(<Fab activeTab="asks" onGetHelp={jest.fn()} onGetService={jest.fn()} />)

    const bar = screen.getByTestId('create-bar-mobile')
    // The non-overlay mechanism is the class contract: full-width (inset-x-0) opaque chrome docked
    // above the nav (.kq-create-bar). A right-corner FAB provably clips right-aligned card actions
    // on a 375px column — measured on the live build, FAB [288–336] ∩ "Explore →" [259–323].
    expect(bar).toHaveClass('kq-create-bar')
    expect(within(bar).getByRole('button')).toHaveAccessibleName('Get Help')
    expect(within(bar).getByRole('button')).toHaveTextContent(/ask for help/i)
  })

  it('keeps a labelled floating FAB on desktop, where there is no bottom nav to dock to', () => {
    const Fab = SpeedDialFab()
    render(<Fab activeTab="asks" onGetHelp={jest.fn()} onGetService={jest.fn()} />)

    const desktop = screen.getByTestId('create-fab-desktop')
    expect(desktop.className).toMatch(/\bfixed\b/)
    expect(within(desktop).getByRole('button')).toHaveAccessibleName('Get Help')
  })

  it('opens the two options from the browse-tab trigger in the docked bar', () => {
    const Fab = SpeedDialFab()
    const onGetService = jest.fn()
    render(<Fab activeTab="browse" onGetHelp={jest.fn()} onGetService={onGetService} />)

    const bar = screen.getByTestId('create-bar-mobile')
    const trigger = within(bar).getByRole('button', { expanded: false })
    expect(trigger).toHaveTextContent(/ask for help/i)

    fireEvent.click(trigger)
    fireEvent.click(within(bar).getByRole('button', { name: /Get Service/ }))
    expect(onGetService).toHaveBeenCalled()
  })

  it('reserves scroll space so the last card clears the docked bar + nav', async () => {
    signIn()
    const Dashboard = require('@/pages/dashboard').default

    const { container } = render(<Dashboard />)

    // jsdom has no layout engine, so geometry is browser-verified (375×812, live build): the docked
    // create bar is full-width opaque chrome above the 64px nav, so no card sits over it at any
    // scroll position; this padding (.kq-fab-safe-bottom → pb-44) keeps the final card reachable
    // above both bars. The class contract is what a future edit cannot silently drop.
    await waitFor(() => {
      expect(container.querySelector('.kq-fab-safe-bottom')).toBeInTheDocument()
    })
    expect(container.querySelector('.pb-20')).toBeNull()
  })
})

// ---------------------------------------------------------------- R-6

describe('R-6 · onboarding overlays never stack (F-1)', () => {
  it('stays hidden while suppressed, even after the flag flips post-mount', () => {
    const { useOnboarding } = require('@/hooks/useOnboarding')

    const { result, rerender } = renderHook(
      ({ suppressed }: { suppressed: boolean }) => useOnboarding('feed', { suppressed }),
      { initialProps: { suppressed: true } }
    )

    expect(result.current.shouldShow).toBe(false)

    // The welcome modal closing must not raise a second overlay on the same visit.
    rerender({ suppressed: false })
    expect(result.current.shouldShow).toBe(false)
  })

  it('shows when nothing suppresses it and the workflow is unseen', () => {
    const { useOnboarding } = require('@/hooks/useOnboarding')

    const { result } = renderHook(() => useOnboarding('feed', { suppressed: false }))

    expect(result.current.shouldShow).toBe(true)
  })

  it('still respects the stored seen-flag', () => {
    localStorage.setItem('karmyq_onboarding', JSON.stringify({ feed: true }))
    const { useOnboarding } = require('@/hooks/useOnboarding')

    const { result } = renderHook(() => useOnboarding('feed', { suppressed: false }))

    expect(result.current.shouldShow).toBe(false)
  })

  it('never renders the welcome modal and a workflow tour at the same time', async () => {
    signIn() // no karmyq_onboarded key → the welcome modal owns this visit
    const Dashboard = require('@/pages/dashboard').default

    render(<Dashboard />)

    // The real WelcomeModal and OnboardingOverlay both mount here (neither is stubbed), so this
    // asserts the invariant itself rather than the wiring: exactly one first-run overlay is on
    // screen. The feed tour's own heading must be absent while the welcome copy is up.
    await waitFor(() => {
      expect(screen.getByText('Welcome to Karmyq!')).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog', { name: 'Your Feed' })).toBeNull()
    expect(screen.queryByText(/A feed ordered by what fits you/i)).toBeNull()
  })

  it('shows the feed tour on a later visit, once the welcome modal is done', async () => {
    signIn()
    localStorage.setItem(`karmyq_onboarded:${signedInUser.id}`, '1')
    const Dashboard = require('@/pages/dashboard').default

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Your Feed' })).toBeInTheDocument()
    })
    expect(screen.queryByText('Welcome to Karmyq!')).toBeNull()
  })

  it('passes the suppression decision down to the hook', async () => {
    signIn()
    const { useOnboarding } = require('@/hooks/useOnboarding')
    const Dashboard = require('@/pages/dashboard').default

    render(<Dashboard />)

    await waitFor(() => expect(useOnboarding).toHaveBeenCalled())
    expect(useOnboarding).toHaveBeenCalledWith('feed', { suppressed: true })
  })
})

// ---------------------------------------------------------------- R-7

describe('R-7 · a sparse ego graph offers the next step (F-5)', () => {
  const { socialGraphService } = require('@/lib/api')

  it('gives the zero-connection state a way into the feed', async () => {
    signIn()
    socialGraphService.getNeighborhood.mockResolvedValue({
      data: { nodes: [{ id: 'user-1', name: 'Maria Reyes' }], links: [] },
    })
    const NetworkPage = require('@/pages/network').default

    await act(async () => { render(<NetworkPage />) })

    await waitFor(() => {
      expect(screen.getByTestId('sparse-network-cta')).toHaveAttribute('href', '/dashboard')
    })
  })

  it('keeps the graph AND shows the prompt at exactly one connection', async () => {
    signIn()
    socialGraphService.getNeighborhood.mockResolvedValue({
      data: {
        nodes: [{ id: 'user-1', name: 'Maria Reyes' }, { id: 'u2', name: 'Isabella Osei' }],
        links: [{ source: 'user-1', target: 'u2' }],
      },
    })
    const NetworkPage = require('@/pages/network').default

    await act(async () => { render(<NetworkPage />) })

    await waitFor(() => expect(screen.getByTestId('belonging-graph')).toBeInTheDocument())
    expect(screen.getByTestId('sparse-network-cta')).toHaveAttribute('href', '/dashboard')
  })

  it('does not nag a member with two or more connections', async () => {
    signIn()
    socialGraphService.getNeighborhood.mockResolvedValue({
      data: {
        nodes: [
          { id: 'user-1', name: 'Maria Reyes' },
          { id: 'u2', name: 'Isabella Osei' },
          { id: 'u3', name: 'Wei Zhang' },
        ],
        links: [
          { source: 'user-1', target: 'u2' },
          { source: 'user-1', target: 'u3' },
        ],
      },
    })
    const NetworkPage = require('@/pages/network').default

    await act(async () => { render(<NetworkPage />) })

    await waitFor(() => expect(screen.getByTestId('belonging-graph')).toBeInTheDocument())
    expect(screen.queryByTestId('sparse-network-cta')).toBeNull()
  })
})

// ---------------------------------------------------------------- R-8

describe('R-8 · the active /network mode pill is on-palette (F-6)', () => {
  it('uses the green primary rather than indigo', async () => {
    signIn()
    const NetworkPage = require('@/pages/network').default

    await act(async () => { render(<NetworkPage />) })

    const activeTab = await screen.findByRole('tab', { selected: true })
    expect(activeTab).toHaveAccessibleName('My Network')
    expect(activeTab.className).toContain('bg-primary')
    expect(activeTab.className).not.toContain('indigo')
  })
})
