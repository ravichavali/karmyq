import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import CommunityConfigEditor from '../../src/components/CommunityConfigEditor'

// Mock the requestService used inside CommunityConfigEditor
jest.mock('../../src/lib/api', () => ({
  requestService: {
    getSchemas: jest.fn(),
  },
}))

const { requestService } = require('../../src/lib/api')

const baseConfig = {
  member_cap: 50,
  visibility_mode: 'public',
  outsider_response_allowed: false,
  enabled_request_types: [{ name: 'generic', description: 'General help', karma_multiplier: 1.0 }],
  karma_split_helper: 70,
  karma_split_requestor: 30,
  base_karma_pool_per_request: 100,
  karma_decay_half_life_days: 90,
  trust_depth_weight: 0.5,
  trust_breadth_weight: 0.5,
  trust_decay_half_life_days: 180,
  trust_path_max_hops: 3,
  min_interactions_for_trust: 3,
  request_approval_required: false,
  new_member_karma_lockout_days: 7,
  join_approval_required: true,
  joining_counts_as_interaction: true,
}

describe('CommunityConfigEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Request Types section', () => {
    it('renders built-in request types without custom schemas', async () => {
      requestService.getSchemas.mockResolvedValue({ data: { schemas: [] } })

      render(<CommunityConfigEditor config={baseConfig} onChange={jest.fn()} />)

      // Expand the Request Types section
      const requestTypesHeader = screen.getByText('Request Types')
      requestTypesHeader.click()

      await waitFor(() => {
        expect(screen.getByText('General Help')).toBeInTheDocument()
        expect(screen.getByText('Ride Share')).toBeInTheDocument()
        expect(screen.getByText('Service Request')).toBeInTheDocument()
      })
    })

    it('merges published custom schemas alongside built-in types', async () => {
      requestService.getSchemas.mockResolvedValue({
        data: {
          schemas: [
            {
              type: 'tutoring',
              label: 'Tutoring Session',
              description: 'Academic help and tutoring',
              icon: '📚',
              color: 'bg-blue-50 border-blue-200',
              status: 'published',
            },
          ],
        },
      })

      render(<CommunityConfigEditor config={baseConfig} onChange={jest.fn()} />)

      // Expand the Request Types section
      screen.getByText('Request Types').click()

      await waitFor(() => {
        expect(screen.getByText('Tutoring Session')).toBeInTheDocument()
        // Built-in types still present
        expect(screen.getByText('General Help')).toBeInTheDocument()
      })
    })

    it('does not duplicate built-in types if they appear in published schemas', async () => {
      requestService.getSchemas.mockResolvedValue({
        data: {
          schemas: [
            {
              type: 'generic', // same as built-in — should be filtered out
              label: 'Generic (custom)',
              description: 'Duplicate',
              icon: '🤝',
              color: '',
              status: 'published',
            },
          ],
        },
      })

      render(<CommunityConfigEditor config={baseConfig} onChange={jest.fn()} />)
      screen.getByText('Request Types').click()

      await waitFor(() => {
        const genericItems = screen.getAllByText('General Help')
        expect(genericItems).toHaveLength(1)
      })
    })

    it('falls back to built-in types when schema fetch fails', async () => {
      requestService.getSchemas.mockRejectedValue(new Error('Network error'))

      render(<CommunityConfigEditor config={baseConfig} onChange={jest.fn()} />)
      screen.getByText('Request Types').click()

      await waitFor(() => {
        expect(screen.getByText('General Help')).toBeInTheDocument()
      })
      // No error thrown to the UI
    })
  })
})
