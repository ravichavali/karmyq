import React from 'react'
import { render, screen } from '@testing-library/react'

// Minimal stubs so we can test just the Schema Manager link logic
// without loading the full CommunityAdminPage (which needs router + APIs)

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

// Extract just the conditional render logic as a test component
// mirroring apps/frontend/src/pages/communities/[id]/admin.tsx lines 355-362
function SchemaManagerLink({ communityCreatorId, currentUserId }: {
  communityCreatorId: string
  currentUserId: string | undefined
}) {
  const Link = require('next/link').default || require('next/link')
  if (communityCreatorId !== currentUserId) return null
  return (
    <Link href="/admin/schemas" className="text-sm font-medium">
      Schema Manager →
    </Link>
  )
}

describe('Schema Manager nav link', () => {
  it('renders the link when current user is the community creator', () => {
    render(
      <SchemaManagerLink communityCreatorId="user-42" currentUserId="user-42" />
    )
    const link = screen.getByText('Schema Manager →')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/admin/schemas')
  })

  it('does not render when current user is not the creator', () => {
    render(
      <SchemaManagerLink communityCreatorId="user-42" currentUserId="user-99" />
    )
    expect(screen.queryByText('Schema Manager →')).not.toBeInTheDocument()
  })

  it('does not render when currentUserId is undefined (not logged in)', () => {
    render(
      <SchemaManagerLink communityCreatorId="user-42" currentUserId={undefined} />
    )
    expect(screen.queryByText('Schema Manager →')).not.toBeInTheDocument()
  })
})
