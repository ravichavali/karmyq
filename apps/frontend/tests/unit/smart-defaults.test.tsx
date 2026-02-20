/**
 * Request Type Selection Tests
 *
 * Verifies that the new request page requires explicit type selection
 * before showing the form — no generic default.
 *
 * UX intent: push users toward structured typed forms.
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock the Next.js router
const mockPush = jest.fn()
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
    query: {},
    pathname: '/requests/new',
  }),
}))

// Mock the API services
jest.mock('../../src/lib/api', () => ({
  requestService: {
    createRequest: jest.fn(),
    getSchema: jest.fn((type: string) => Promise.resolve({
      data: {
        data: {
          schema: {
            type,
            version: 1,
            label: type === 'generic' ? 'General Help' : type.charAt(0).toUpperCase() + type.slice(1),
            icon: '🤝',
            color: 'blue',
            description: `${type} request`,
            sections: [],
          }
        }
      }
    })),
    getSchemas: jest.fn(() => Promise.resolve({ data: { data: [] } })),
  },
  communityService: {
    getCommunities: jest.fn(() => Promise.resolve({
      data: {
        data: [
          { id: 'comm-1', name: 'Test Community' }
        ]
      }
    })),
  },
}))

// Mock Layout component
jest.mock('../../src/components/Layout', () => {
  return function Layout({ children }: { children: React.ReactNode }) {
    return <div data-testid="layout">{children}</div>
  }
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('Request Type Selection — mandatory type-first UX', () => {
  beforeEach(() => {
    localStorageMock.clear()
    localStorageMock.setItem('user', JSON.stringify({
      id: 'user-1',
      email: 'test@example.com',
    }))
    jest.clearAllMocks()
  })

  describe('Initial State (no type selected)', () => {
    it('should show the page header', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      await act(async () => {
        render(<NewRequestPage />)
      })

      expect(screen.getByText('Create Help Request')).toBeInTheDocument()
    })

    it('should show type selector immediately without requiring a click', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      await act(async () => {
        render(<NewRequestPage />)
      })

      // Type selector label should be visible right away
      expect(screen.getByText(/What kind of help do you need/)).toBeInTheDocument()
    })

    it('should NOT show the community select or form fields before type is selected', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      await act(async () => {
        render(<NewRequestPage />)
      })

      expect(screen.queryByLabelText(/Community/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Title/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Description/)).not.toBeInTheDocument()
    })

    it('should NOT show a submit button before type is selected', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      await act(async () => {
        render(<NewRequestPage />)
      })

      expect(screen.queryByText('Create Request')).not.toBeInTheDocument()
    })
  })

  describe('After type selection', () => {
    it('should show form fields after selecting a type', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      await act(async () => {
        render(<NewRequestPage />)
      })

      // Select generic type
      const genericButton = screen.getByText('General Help').closest('button')
      await act(async () => {
        fireEvent.click(genericButton!)
      })

      // Form fields should now be visible
      expect(screen.getByLabelText(/Community/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Title/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
      expect(screen.getByText('Create Request')).toBeInTheDocument()
    })

    it('should show title and description as required for generic type', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      await act(async () => {
        render(<NewRequestPage />)
      })

      const genericButton = screen.getByText('General Help').closest('button')
      await act(async () => {
        fireEvent.click(genericButton!)
      })

      // Title and description should be required (no "optional" label)
      expect(screen.queryByText('(optional)')).not.toBeInTheDocument()
    })

    it('should allow selecting ride type and show form', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      await act(async () => {
        render(<NewRequestPage />)
      })

      const rideButton = screen.getByText('Ride Share').closest('button')
      await act(async () => {
        fireEvent.click(rideButton!)
      })

      expect(screen.getByLabelText(/Community/)).toBeInTheDocument()
      expect(screen.getByText('Create Request')).toBeInTheDocument()
    })
  })

  describe('Structured type (schema with sections)', () => {
    it('should show title as required for generic (no sections)', async () => {
      // Generic schema has no sections — title/description required
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      await act(async () => {
        render(<NewRequestPage />)
      })

      const genericButton = screen.getByText('General Help').closest('button')
      await act(async () => {
        fireEvent.click(genericButton!)
      })

      // For generic (no sections), there should be no "(optional)" hint
      expect(screen.queryByText('(optional)')).not.toBeInTheDocument()
    })
  })

  describe('Submit behavior', () => {
    it('should submit with correct request_type after selecting generic', async () => {
      const { requestService } = await import('../../src/lib/api')
      const NewRequestPage = (await import('../../src/pages/requests/new')).default

      await act(async () => {
        render(<NewRequestPage />)
      })

      // Select generic
      const genericButton = screen.getByText('General Help').closest('button')
      await act(async () => {
        fireEvent.click(genericButton!)
      })

      await screen.findByText('Test Community')

      const communitySelect = screen.getByLabelText(/Community/)
      const titleInput = screen.getByLabelText(/Title/)
      const descriptionTextarea = screen.getByLabelText(/Description/)

      await act(async () => {
        fireEvent.change(communitySelect, { target: { value: 'comm-1' } })
        fireEvent.change(titleInput, { target: { value: 'Need help moving' } })
        fireEvent.change(descriptionTextarea, { target: { value: 'Need help moving some boxes this weekend' } })
      })

      ;(requestService.createRequest as jest.Mock).mockResolvedValueOnce({
        data: { data: { id: 'req-123' } }
      })

      const submitButton = screen.getByText('Create Request')
      await act(async () => {
        fireEvent.click(submitButton)
      })

      expect(requestService.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          request_type: 'generic',
          community_id: 'comm-1',
          title: 'Need help moving',
          description: 'Need help moving some boxes this weekend',
        })
      )
    })
  })
})
