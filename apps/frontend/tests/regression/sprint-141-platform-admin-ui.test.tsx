/**
 * Sprint 141 (BUG-073, ADR-105): the platform admin UI is shown to platform admins only.
 *
 * `usePlatformAdmin` asks auth-service whether the signed-in user holds an `auth.platform_admins` grant
 * (`GET /users/me/platform-role`). It is a hint: each gated service re-checks live, so the hook fails closed
 * on every error. The five platform admin pages wait for it and fire no admin request until it says yes, and the
 * two "Schema Manager" links are shown to platform admins, not to community admins.
 *
 * Real hook, components and pages; the API client, the router and the page shells are mocked. The API mocks
 * resolve what the client resolves AFTER its interceptor has unwrapped the ADR-074 envelope (`res.data` is the
 * payload).
 */
import React from 'react'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'

const mockPlatformRole = jest.fn()
const mockTrustList = jest.fn()
const mockGetAdminSchemas = jest.fn()
const mockGetAdminSchema = jest.fn()
const mockGetSchemaVersions = jest.fn()
const mockGetSchemas = jest.fn()
jest.mock('@/lib/api', () => ({
  platformRoleService: { get: (...a: unknown[]) => mockPlatformRole(...a) },
  trustQuestionsService: { list: (...a: unknown[]) => mockTrustList(...a) },
  uiSchemaService: {
    getAdminSchemas: (...a: unknown[]) => mockGetAdminSchemas(...a),
    getAdminSchema: (...a: unknown[]) => mockGetAdminSchema(...a),
    getSchemaVersions: (...a: unknown[]) => mockGetSchemaVersions(...a),
  },
  requestService: { getSchemas: (...a: unknown[]) => mockGetSchemas(...a) },
}))
// One stable router object: the pages' effects depend on it, and the assertions read its push mock.
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn().mockResolvedValue(undefined),
  pathname: '/',
  route: '/',
  query: {} as Record<string, string>,
  asPath: '/',
  events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
}
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}))
jest.mock('@/components/admin/AdminLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}))

import { usePlatformAdmin } from '@/hooks/usePlatformAdmin'
import CommunityHero from '@/components/community/CommunityHero'
import CommunityConfigEditor from '@/components/CommunityConfigEditor'
import TrustQuestionsAdminPage from '@/pages/admin/trust-questions'
import SchemaListPage from '@/pages/admin/schemas'
import NewSchemaPage from '@/pages/admin/schemas/new'
import SchemaEditorPage from '@/pages/admin/schemas/[id]/edit'
import VersionHistoryPage from '@/pages/admin/schemas/[id]/versions'

const granted = { data: { platformAdmin: true } }
const notGranted = { data: { platformAdmin: false } }
const never = () => new Promise(() => undefined)
/** Let every pending promise callback (the role check, then the page fetch) run. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

beforeEach(() => {
  // The frontend jest config clears nothing between tests; reset explicitly.
  for (const m of [mockPlatformRole, mockTrustList, mockGetAdminSchemas, mockGetAdminSchema, mockGetSchemaVersions, mockGetSchemas, mockRouter.push]) {
    m.mockReset()
  }
  mockRouter.query = {}
  mockGetSchemas.mockResolvedValue({ data: { schemas: [] } })
  localStorage.clear()
  localStorage.setItem('token', 'signed-in')
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => jest.restoreAllMocks())

describe('usePlatformAdmin', () => {
  it('answers true when the live check says platformAdmin: true, asking once', async () => {
    mockPlatformRole.mockResolvedValue(granted)
    const { result } = renderHook(() => usePlatformAdmin())
    expect(result.current).toEqual({ loading: true, platformAdmin: false })
    await waitFor(() => expect(result.current).toEqual({ loading: false, platformAdmin: true }))
    expect(mockPlatformRole).toHaveBeenCalledTimes(1)
    expect(mockPlatformRole).toHaveBeenCalledWith()
  })
  it('answers false for platformAdmin: false', async () => {
    mockPlatformRole.mockResolvedValue(notGranted)
    const { result } = renderHook(() => usePlatformAdmin())
    await waitFor(() => expect(result.current).toEqual({ loading: false, platformAdmin: false }))
  })
  it.each([
    ['a rejected request', () => Promise.reject({ response: { status: 500 } })],
    ['a truthy non-boolean', () => Promise.resolve({ data: { platformAdmin: 'yes' } })],
    ['a still-wrapped envelope', () => Promise.resolve({ data: { success: true, data: { platformAdmin: true } } })],
    ['no payload', () => Promise.resolve({})],
  ])('fails closed on %s, without throwing', async (_label, answer) => {
    mockPlatformRole.mockImplementation(answer)
    const { result } = renderHook(() => usePlatformAdmin())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.platformAdmin).toBe(false)
  })
  it('with no token, makes no request and answers false', async () => {
    localStorage.removeItem('token')
    const { result } = renderHook(() => usePlatformAdmin())
    await waitFor(() => expect(result.current).toEqual({ loading: false, platformAdmin: false }))
    expect(mockPlatformRole).not.toHaveBeenCalled()
  })
})

const community = {
  id: 'c1', name: 'Maple Street', description: 'Neighbours', current_members: 120, max_members: 150,
  access_type: 'public' as const, creator_id: 'u1', creator_name: 'Ada', status: 'active', members: [],
  size_alert: 'recommend_split' as const, active_split_proposal: null,
}
const renderHero = (isAdmin: boolean) => render(
  <CommunityHero community={community} isMember isPending={false} isAdmin={isAdmin} joiningCommunity={false}
    onJoin={jest.fn()} onShowFission={jest.fn()} />,
)

describe('CommunityHero: "Schema Manager →" is a platform admin link', () => {
  it('a community admin who is not a platform admin sees no link, and keeps the community-admin split action', async () => {
    mockPlatformRole.mockResolvedValue(notGranted)
    renderHero(true)
    await settle()
    expect(mockPlatformRole).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Schema Manager →')).not.toBeInTheDocument()
    expect(screen.getByText('Propose Split →')).toBeInTheDocument()
  })
  it('a platform admin with no community role sees the link to /admin/schemas', async () => {
    mockPlatformRole.mockResolvedValue(granted)
    renderHero(false)
    const link = await screen.findByText('Schema Manager →')
    expect(link.closest('a')).toHaveAttribute('href', '/admin/schemas')
    expect(screen.queryByText('Propose Split →')).not.toBeInTheDocument()
  })
  it('a failed role check shows no link', async () => {
    mockPlatformRole.mockRejectedValue(new Error('network'))
    renderHero(true)
    await settle()
    expect(screen.queryByText('Schema Manager →')).not.toBeInTheDocument()
  })
})

const baseConfig = {
  member_cap: 50, visibility_mode: 'public' as const, outsider_response_allowed: false,
  enabled_request_types: [{ name: 'generic', description: 'General help', karma_multiplier: 1.0 }],
  karma_split_helper: 70, karma_split_requestor: 30, base_karma_pool_per_request: 100, karma_decay_half_life_days: 90,
  trust_depth_weight: 0.5, trust_breadth_weight: 0.5, trust_decay_half_life_days: 180, trust_path_max_hops: 3,
  min_interactions_for_trust: 3, request_approval_required: false, new_member_karma_lockout_days: 7,
  join_approval_required: true, joining_counts_as_interaction: true,
}
const renderEditor = async () => {
  render(<CommunityConfigEditor config={baseConfig} onChange={jest.fn()} />)
  await act(async () => { screen.getByText('Request Types').click() })
  await settle()
}

describe('CommunityConfigEditor: "Open Schema Manager →" is a platform admin hint', () => {
  it('an editing community admin who is not a platform admin sees no hint', async () => {
    mockPlatformRole.mockResolvedValue(notGranted)
    await renderEditor()
    expect(screen.getByText('General Help')).toBeInTheDocument() // the section is open
    expect(screen.queryByText('Open Schema Manager →')).not.toBeInTheDocument()
    expect(screen.queryByText(/Want a custom type\?/)).not.toBeInTheDocument()
  })
  it('a platform admin sees the hint linking to /admin/schemas', async () => {
    mockPlatformRole.mockResolvedValue(granted)
    await renderEditor()
    expect(screen.getByText('Open Schema Manager →').closest('a')).toHaveAttribute('href', '/admin/schemas')
  })
})

// [label, page, the admin request it fires on mount once allowed (none for the create form), router query]
type PageRow = [string, React.ComponentType, jest.Mock | null, Record<string, string>]
const pages: PageRow[] = [
  ['trust questions', TrustQuestionsAdminPage, mockTrustList, {}],
  ['schema list', SchemaListPage, mockGetAdminSchemas, {}],
  ['new schema', NewSchemaPage, null, {}],
  ['schema editor', SchemaEditorPage, mockGetAdminSchema, { id: 's1' }],
  ['version history', VersionHistoryPage, mockGetSchemaVersions, { id: 's1' }],
]
const adminRequests = () => [mockTrustList, mockGetAdminSchemas, mockGetAdminSchema, mockGetSchemaVersions]
  .reduce((n, m) => n + m.mock.calls.length, 0)

describe.each(pages)('the %s page waits for the live platform check', (_label, Page, fetch, query) => {
  beforeEach(() => {
    mockRouter.query = query
    // Empty but well-formed payloads, already unwrapped by the client's interceptor.
    mockTrustList.mockResolvedValue({ data: { questions: [] } })
    mockGetAdminSchemas.mockResolvedValue({ data: { schemas: [], total: 0 } })
    mockGetSchemaVersions.mockResolvedValue({ data: { versions: [] } })
    mockGetAdminSchema.mockImplementation(never)
  })

  it('renders nothing and fetches nothing while the check is pending', async () => {
    mockPlatformRole.mockImplementation(never)
    const { container } = render(<Page />)
    await settle()
    expect(container).toBeEmptyDOMElement()
    expect(adminRequests()).toBe(0)
    expect(mockRouter.push).not.toHaveBeenCalled()
  })
  it('a community admin who is not a platform admin goes to /dashboard; nothing rendered or fetched', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'a@b.c', communities: [{ id: 'c1', name: 'Mine', role: 'admin' }] }))
    mockPlatformRole.mockResolvedValue(notGranted)
    const { container } = render(<Page />)
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/dashboard'))
    expect(container).toBeEmptyDOMElement()
    expect(adminRequests()).toBe(0)
  })
  it('a failed check also goes to /dashboard (fail closed)', async () => {
    mockPlatformRole.mockRejectedValue(new Error('network'))
    render(<Page />)
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/dashboard'))
    expect(adminRequests()).toBe(0)
  })
  it('no token goes to /login, with no role check', async () => {
    localStorage.removeItem('token')
    render(<Page />)
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/login'))
    expect(mockPlatformRole).not.toHaveBeenCalled()
    expect(adminRequests()).toBe(0)
  })
  it('a platform admin sees the page and its admin request fires once', async () => {
    mockPlatformRole.mockResolvedValue(granted)
    render(<Page />)
    expect(await screen.findByTestId('shell')).toBeInTheDocument()
    await settle()
    if (fetch) expect(fetch).toHaveBeenCalledTimes(1)
    expect(mockRouter.push).not.toHaveBeenCalled()
  })
})

describe('the platform admin pages pass the right arguments', () => {
  it('the schema editor loads the schema named by the route', async () => {
    mockRouter.query = { id: 's1' }
    mockPlatformRole.mockResolvedValue(granted)
    mockGetAdminSchema.mockImplementation(never)
    mockGetSchemaVersions.mockResolvedValue({ data: { versions: [] } })
    render(<SchemaEditorPage />)
    await waitFor(() => expect(mockGetAdminSchema).toHaveBeenCalledWith('s1'))
    expect(mockGetSchemaVersions).toHaveBeenCalledWith('s1')
  })
  it('the version history loads the versions of the schema named by the route', async () => {
    mockRouter.query = { id: 's1' }
    mockPlatformRole.mockResolvedValue(granted)
    mockGetSchemaVersions.mockResolvedValue({ data: { versions: [] } })
    render(<VersionHistoryPage />)
    await waitFor(() => expect(mockGetSchemaVersions).toHaveBeenCalledWith('s1'))
  })
})
