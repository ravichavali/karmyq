/**
 * Smart Defaults Test - Day 6 UX Improvements
 *
 * Verifies that the new request page defaults to generic request
 * with progressive disclosure for other request types.
 *
 * Target: < 3 clicks to create generic request
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
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

describe('Smart Defaults - Progressive Disclosure (Day 6)', () => {
  beforeEach(() => {
    localStorageMock.clear()
    localStorageMock.setItem('user', JSON.stringify({
      id: 'user-1',
      email: 'test@example.com',
    }))
    jest.clearAllMocks()
  })

  describe('Default State', () => {
    it('should default to generic request type', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Should show "General Help" as current request type in the header
      expect(screen.getByText(/Request type:/)).toBeInTheDocument()
      // The header span shows "General Help" (not "General Help Request")
      const typeSpan = screen.getByText('General Help', { selector: 'span.font-medium.text-blue-600' })
      expect(typeSpan).toBeInTheDocument()
    })

    it('should show the generic request form immediately', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Should show the generic form header
      expect(screen.getByText('🤝 General Help Request')).toBeInTheDocument()
    })

    it('should have type selector collapsed by default', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Should show collapsed state indicator
      expect(screen.getByText('Need a specific type?')).toBeInTheDocument()

      // Type selector grid should NOT be visible initially
      expect(screen.queryByText('What type of help do you need?')).not.toBeInTheDocument()
    })
  })

  describe('Progressive Disclosure', () => {
    it('should expand type selector when clicked', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Click the "Need a specific type?" button
      const expandButton = screen.getByText('Need a specific type?').closest('button')
      expect(expandButton).toBeInTheDocument()

      fireEvent.click(expandButton!)

      // Now type selector should be visible
      expect(screen.getByText('What type of help do you need?')).toBeInTheDocument()
    })

    it('should show examples when type selector is expanded', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Expand type selector
      const expandButton = screen.getByText('Need a specific type?').closest('button')
      fireEvent.click(expandButton!)

      // Should show example text for ride type
      expect(screen.getByText(/e.g., ride to airport/)).toBeInTheDocument()
    })

    it('should show "Most used" badge on generic type', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Expand type selector
      const expandButton = screen.getByText('Need a specific type?').closest('button')
      fireEvent.click(expandButton!)

      // Should show "Most used" badge
      expect(screen.getByText('Most used')).toBeInTheDocument()
    })

    it('should collapse type selector after selecting a type', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Expand type selector
      const expandButton = screen.getByText('Need a specific type?').closest('button')
      fireEvent.click(expandButton!)

      // Select ride type
      const rideButton = screen.getByText('Ride Share').closest('button')
      fireEvent.click(rideButton!)

      // Type selector should collapse (grid hidden)
      expect(screen.queryByText('What type of help do you need?')).not.toBeInTheDocument()

      // Should update request type display in header
      const typeSpan = screen.getByText('Ride', { selector: 'span.font-medium.text-blue-600' })
      expect(typeSpan).toBeInTheDocument()
    })
  })

  describe('Click Count Target (< 3 clicks)', () => {
    it('should allow creating generic request with minimal clicks', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      const { requestService } = await import('../../src/lib/api')

      render(<NewRequestPage />)

      // Wait for communities to load
      await screen.findByText('Test Community')

      // Click count: 0 (form already shown, no type selection needed)

      // Fill in required fields
      const communitySelect = screen.getByLabelText(/Community/)
      const titleInput = screen.getByLabelText(/Title/)
      const descriptionTextarea = screen.getByLabelText(/Description/)

      fireEvent.change(communitySelect, { target: { value: 'comm-1' } }); // Click 1
      fireEvent.change(titleInput, { target: { value: 'Need help moving' } });
      fireEvent.change(descriptionTextarea, { target: { value: 'Need help moving some boxes this weekend' } });

      // Mock successful API call
      (requestService.createRequest as jest.Mock).mockResolvedValueOnce({
        data: { data: { id: 'req-123' } }
      })

      // Submit form
      const submitButton = screen.getByText('Create Request')
      fireEvent.click(submitButton) // Click 2 (form filling not counted)

      // Total clicks for generic request: 2 (community select + submit)
      // This is < 3 clicks ✓

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

  describe('Type Switching', () => {
    it('should allow switching to a specific type', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Expand type selector
      const expandButton = screen.getByText('Need a specific type?').closest('button')
      fireEvent.click(expandButton!)

      // Select ride type
      const rideButton = screen.getByText('Ride Share').closest('button')
      fireEvent.click(rideButton!)

      // Should show ride form
      expect(screen.getByText(/Ride Share Request/)).toBeInTheDocument()

      // Request type should update in header
      const typeSpan = screen.getByText('Ride', { selector: 'span.font-medium.text-blue-600' })
      expect(typeSpan).toBeInTheDocument()
    })

    it('should allow switching back to generic', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Expand and select ride
      const expandButton = screen.getByText('Need a specific type?').closest('button')
      fireEvent.click(expandButton!)

      const rideButton = screen.getByText('Ride Share').closest('button')
      fireEvent.click(rideButton!)

      // Expand again and select generic
      fireEvent.click(expandButton!)

      const genericButton = screen.getByText('General Help').closest('button')
      fireEvent.click(genericButton!)

      // Should show generic form again
      expect(screen.getByText('🤝 General Help Request')).toBeInTheDocument()
    })
  })

  describe('UX Guidance', () => {
    it('should show helpful guidance for generic requests', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Should show guidance section
      expect(screen.getByText('💡 What to Include')).toBeInTheDocument()

      // Should show examples
      expect(screen.getByText('📝 Example Requests')).toBeInTheDocument()
      expect(screen.getByText('Help moving boxes to storage unit')).toBeInTheDocument()
    })

    it('should suggest specialized types when appropriate', async () => {
      const NewRequestPage = (await import('../../src/pages/requests/new')).default
      render(<NewRequestPage />)

      // Should show category suggestions
      expect(screen.getByText('💭 Consider Other Categories')).toBeInTheDocument()
      expect(screen.getByText(/Need transportation to a specific place/)).toBeInTheDocument()
    })
  })
})
