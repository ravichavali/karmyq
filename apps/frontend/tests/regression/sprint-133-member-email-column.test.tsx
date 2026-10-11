import React from 'react'
import { render, screen } from '@testing-library/react'

// BUG-062 follow-up: the server returns other members' emails to live admins only, so the People
// tab must not render an Email column (blank for everyone but the moderator) to moderators.
jest.mock('@/lib/api', () => ({ communityService: { updateMember: jest.fn(), removeMember: jest.fn() } }))

import ActiveTab from '@/components/community/tabs/ActiveTab'

const community: any = {
  id: 'comm-1', name: 'C', creator_id: 'admin-1', current_members: 3,
  members: [
    { id: 'm1', user_id: 'admin-1', user_name: 'Ada Admin', role: 'admin', status: 'active', joined_at: '2026-01-01', user_email: 'ada@x.test' },
    { id: 'm2', user_id: 'mod-1', user_name: 'Mo Mod', role: 'moderator', status: 'active', joined_at: '2026-01-02' },
    { id: 'm3', user_id: 'pend-1', user_name: 'Pat Pending', role: 'member', status: 'pending', joined_at: '2026-01-03', join_request_message: 'hi' },
  ],
}

function renderAs(isAdmin: boolean) {
  return render(
    <ActiveTab
      community={community}
      norms={[]}
      currentUser={{ id: isAdmin ? 'admin-1' : 'mod-1' }}
      isAdmin={isAdmin}
      isAdminOrMod
      isMember
      communityId="comm-1"
      refetchCommunity={jest.fn()}
      refetchNorms={jest.fn()}
    />,
  )
}

describe('ActiveTab member email column (BUG-062)', () => {
  it('shows the Email column to an admin', () => {
    renderAs(true)
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument()
    expect(screen.getByText('ada@x.test')).toBeInTheDocument()
  })

  it('hides the Email column from a moderator, who receives no other emails', () => {
    renderAs(false)
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument()
    // Pending requests stay visible to moderators (they approve joins).
    expect(screen.getByText('Pat Pending')).toBeInTheDocument()
  })
})
