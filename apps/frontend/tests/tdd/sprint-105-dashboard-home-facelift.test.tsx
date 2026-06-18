import fs from 'fs'
import path from 'path'
import { render, screen } from '@testing-library/react'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'
import { requestService } from '@/lib/api'

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: jest.fn(),
    createMatch: jest.fn(),
  },
  dibsService: { acceptDibs: jest.fn(), declineDibs: jest.fn() },
}))

jest.mock('@/hooks/useTrustPath', () => ({
  useTrustPath: () => ({ trustPath: null, loading: false, error: null }),
}))

const source = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('Sprint 105 Dashboard Home facelift', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }))
    ;(requestService.getCuratedRequests as jest.Mock).mockResolvedValue({ data: { items: [] } })
  })

  it('adds a secondary Home altitude for established users with an empty primary queue', async () => {
    render(<UnifiedFeed view="home" noCommunities={false} />)

    expect(await screen.findByText("You're caught up")).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Still want to lend a hand?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse your communities' })).toHaveAttribute('href', '/communities')
  })

  it('does not show secondary altitude for a no-community user', async () => {
    render(<UnifiedFeed view="home" noCommunities />)

    expect(await screen.findByText('Join a community to see requests')).toBeInTheDocument()
    expect(screen.queryByText('Still want to lend a hand?')).not.toBeInTheDocument()
  })

  it('tokenizes Dashboard selector/on-duty and routes zero-community through EmptyState', () => {
    const dashboard = source('src/pages/dashboard.tsx')

    expect(dashboard).not.toMatch(/bg-amber-100|text-amber-700|You haven't joined/)
    expect(dashboard).toMatch(/aria-label="Status: On duty"/)
    expect(dashboard).toMatch(/<EmptyState[\s\S]*heading="Join a community to see requests"/)
    expect(dashboard).toMatch(/className="kq-page/)
  })
})
