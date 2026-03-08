import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import TrustModelDiff from '../../src/components/TrustModelDiff'
import { CommunityConfig } from '../../src/types/community-config'

const BASE_CONFIG: CommunityConfig = {
  member_cap: 100,
  visibility_mode: 'hybrid',
  outsider_response_allowed: false,
  enabled_request_types: [],
  karma_split_helper: 60,
  karma_split_requestor: 40,
  base_karma_pool_per_request: 100,
  karma_decay_half_life_days: 90,
  trust_depth_weight: 0.6,
  trust_breadth_weight: 0.4,
  trust_decay_half_life_days: 180,
  trust_path_max_hops: 3,
  min_interactions_for_trust: 2,
  request_approval_required: false,
  new_member_karma_lockout_days: 7,
  join_approval_required: true,
  joining_counts_as_interaction: false,
}

describe('TrustModelDiff', () => {
  const onApplyAll = jest.fn()
  const onApplySelective = jest.fn()
  const onDiscard = jest.fn()

  beforeEach(() => {
    onApplyAll.mockClear()
    onApplySelective.mockClear()
    onDiscard.mockClear()
  })

  it('shows empty diff message when nothing would change', () => {
    render(
      <TrustModelDiff
        current={BASE_CONFIG}
        proposed={{ member_cap: 100 }}
        onApplyAll={onApplyAll}
        onApplySelective={onApplySelective}
        onDiscard={onDiscard}
      />
    )
    expect(screen.getByText(/already matches/i)).toBeInTheDocument()
  })

  it('shows changed fields in the table', () => {
    render(
      <TrustModelDiff
        current={BASE_CONFIG}
        proposed={{ member_cap: 50, visibility_mode: 'members_only' }}
        onApplyAll={onApplyAll}
        onApplySelective={onApplySelective}
        onDiscard={onDiscard}
      />
    )
    expect(screen.getByText('Member Cap')).toBeInTheDocument()
    expect(screen.getByText('Visibility')).toBeInTheDocument()
  })

  it('calls onApplyAll when Apply All is clicked', () => {
    render(
      <TrustModelDiff
        current={BASE_CONFIG}
        proposed={{ member_cap: 50 }}
        onApplyAll={onApplyAll}
        onApplySelective={onApplySelective}
        onDiscard={onDiscard}
      />
    )
    fireEvent.click(screen.getByText(/apply all changes/i))
    expect(onApplyAll).toHaveBeenCalledTimes(1)
  })

  it('calls onDiscard when Discard is clicked', () => {
    render(
      <TrustModelDiff
        current={BASE_CONFIG}
        proposed={{ member_cap: 50 }}
        onApplyAll={onApplyAll}
        onApplySelective={onApplySelective}
        onDiscard={onDiscard}
      />
    )
    fireEvent.click(screen.getByText('Discard'))
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('calls onApplySelective with selected fields', () => {
    render(
      <TrustModelDiff
        current={BASE_CONFIG}
        proposed={{ member_cap: 50, visibility_mode: 'members_only' }}
        onApplyAll={onApplyAll}
        onApplySelective={onApplySelective}
        onDiscard={onDiscard}
      />
    )
    // Both checked by default — uncheck member_cap checkbox
    const checkboxes = screen.getAllByRole('checkbox')
    // Find the member_cap row checkbox (not the select-all)
    // Click the first field checkbox to deselect it
    fireEvent.click(checkboxes[1]) // first field row checkbox
    fireEvent.click(screen.getByText(/apply selected/i))
    expect(onApplySelective).toHaveBeenCalledTimes(1)
    expect(onApplySelective.mock.calls[0][0]).toHaveLength(1)
  })
})
