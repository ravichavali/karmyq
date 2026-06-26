import React from 'react'
import fs from 'fs'
import path from 'path'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('@/components/BelongingGraph', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid="belonging-graph"
      data-mode={props.mode}
      data-communityid={props.communityId ?? ''}
    />
  ),
}))

jest.mock('@/components/relationships/ReWarmingNudge', () => () => <div data-testid="rewarm" />)

jest.mock('@/lib/api', () => ({
  requestService: {
    getCuratedRequests: jest.fn().mockResolvedValue({
      data: { items: [], count: 0, offeredAwaiting: 0 },
    }),
  },
}))

import TrustGraphTab from '@/components/community/tabs/TrustGraphTab'
import UnifiedFeed from '@/components/Feed/UnifiedFeed'

const FRONTEND_ROOT = path.resolve(__dirname, '../..')
const source = (relativePath: string) => fs.readFileSync(path.join(FRONTEND_ROOT, relativePath), 'utf8')
const exists = (relativePath: string) => fs.existsSync(path.join(FRONTEND_ROOT, relativePath))

describe('S114 belonging graph surface consolidation', () => {
  it('keeps the community graph home and retires the community My Network sub-tab', () => {
    render(<TrustGraphTab communityId="c1" currentUserId="u1" />)

    expect(screen.getByTestId('belonging-graph')).toHaveAttribute('data-mode', 'community')
    expect(screen.queryByRole('button', { name: /my network/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /how communities connect/i })).toHaveAttribute(
      'href',
      '/network?mode=communities'
    )
  })

  it('retires the Home feed My Network preview card', async () => {
    render(<UnifiedFeed view="home" />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /my network/i })).not.toBeInTheDocument()
  })

  it('removes the live Home preview import', () => {
    expect(source('src/components/Feed/UnifiedFeed.tsx')).not.toMatch(/MyNetworkPreview/)
  })

  it('deletes the orphaned dashboard graph widget rather than treating it as a live surface', () => {
    expect(source('src/pages/dashboard.tsx')).not.toMatch(/TrustNetworkWidget/)
    expect(exists('src/components/dashboard/TrustNetworkWidget.tsx')).toBe(false)
  })
})
