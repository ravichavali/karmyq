/**
 * Sprint 140 — BUG-098: the preferences page reads the intercepted responses exactly once.
 *
 * Auth service answers GET /preferences/request-types with `{ success, data: { preferences, isDefault } }`,
 * GET /preferences/interests with `{ success, data: { interests, grouped, count } }` and POST /preferences/interests
 * with `{ success, data: { id, interest_type, interest_value, message, isNew } }`. The API client's interceptor
 * already replaced `response.data` with the envelope's `data`, but the page still checked `response.data.success`
 * (now undefined) and read `response.data.data.*`. So saved preferences and interests never loaded — the page
 * always showed its all-subscribed defaults — and adding an interest never updated the screen.
 *
 * Only the API module and the app shell are mocked; the mocks resolve with the interceptor's output.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockGetPrefs = jest.fn()
const mockGetInterests = jest.fn()
const mockAddInterest = jest.fn()
const mockRemoveInterest = jest.fn()
jest.mock('@/lib/api', () => ({
  userSettingsService: {
    getRequestTypePreferences: (...a: unknown[]) => mockGetPrefs(...a),
    getInterests: (...a: unknown[]) => mockGetInterests(...a),
    addInterest: (...a: unknown[]) => mockAddInterest(...a),
    removeInterest: (...a: unknown[]) => mockRemoveInterest(...a),
    updateRequestTypePreference: jest.fn(),
    bulkUpdatePreferences: jest.fn(),
  },
}))
jest.mock('@/components/Layout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import PreferencesPage from '@/pages/settings/preferences'

/** Request types render in REQUEST_TYPE_INFO order: generic, ride, service, event, borrow. */
const SAVED = [
  { request_type: 'generic', subscribed: true },
  { request_type: 'ride', subscribed: false },
  { request_type: 'service', subscribed: true },
  { request_type: 'event', subscribed: false },
  { request_type: 'borrow', subscribed: false },
]
const PLUMBING = { id: 'i-plumbing', interest_type: 'service_category', interest_value: 'plumbing', created_at: '2026-11-01T00:00:00Z' }

const checkboxStates = () => (screen.getAllByRole('checkbox') as HTMLInputElement[]).map((c) => c.checked)
const isSelected = (label: string) => screen.getByRole('button', { name: label }).className.includes('bg-primary-light')

let alertSpy: jest.SpyInstance
beforeEach(() => {
  // The frontend jest config clears nothing between tests; reset explicitly.
  for (const m of [mockGetPrefs, mockGetInterests, mockAddInterest, mockRemoveInterest]) m.mockReset()
  localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Ana' }))
  alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined)
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  mockGetPrefs.mockResolvedValue({ data: { preferences: SAVED, isDefault: false } })
  mockGetInterests.mockResolvedValue({ data: { interests: [PLUMBING], grouped: {}, count: 1 } })
})
afterEach(() => {
  localStorage.clear()
  jest.restoreAllMocks()
})

describe('preferences page loads the saved preferences and interests (BUG-098)', () => {
  it('shows the saved subscriptions, not the all-subscribed defaults', async () => {
    render(<PreferencesPage />)
    await waitFor(() => expect(checkboxStates()).toEqual([true, false, true, false, false]))
    expect(screen.getAllByText('Subscribed')).toHaveLength(2)
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('marks the saved interests as selected', async () => {
    render(<PreferencesPage />)
    await waitFor(() => expect(isSelected('plumbing')).toBe(true))
    expect(isSelected('tutoring')).toBe(false)
  })

  it('a failed load keeps the existing error handling', async () => {
    mockGetPrefs.mockRejectedValue(new Error('down'))
    render(<PreferencesPage />)
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to load preferences'))
  })
})

describe('adding an interest updates the screen from the unwrapped payload (BUG-098)', () => {
  it('selects the new interest and keeps its server id, so removing it sends that id', async () => {
    mockAddInterest.mockResolvedValue({
      data: { id: 'i-new', interest_type: 'service_category', interest_value: 'tutoring', message: 'Interest added successfully', isNew: true },
    })
    mockRemoveInterest.mockResolvedValue({ data: {} })
    render(<PreferencesPage />)
    await waitFor(() => expect(isSelected('plumbing')).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'tutoring' }))
    await waitFor(() => expect(isSelected('tutoring')).toBe(true))
    expect(mockAddInterest).toHaveBeenCalledWith({ interest_type: 'service_category', interest_value: 'tutoring' })

    fireEvent.click(screen.getByRole('button', { name: 'tutoring' }))
    await waitFor(() => expect(isSelected('tutoring')).toBe(false))
    expect(mockRemoveInterest).toHaveBeenCalledWith('i-new')
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('an interest the server already had (isNew false) is not added twice', async () => {
    mockAddInterest.mockResolvedValue({
      data: { id: null, interest_type: 'service_category', interest_value: 'tutoring', message: 'Interest already exists', isNew: false },
    })
    render(<PreferencesPage />)
    await waitFor(() => expect(isSelected('plumbing')).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'tutoring' }))
    await waitFor(() => expect(mockAddInterest).toHaveBeenCalledTimes(1))
    expect(isSelected('tutoring')).toBe(false)
  })
})
