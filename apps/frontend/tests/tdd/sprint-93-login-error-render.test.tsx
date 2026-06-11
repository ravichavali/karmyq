/**
 * Sprint 93 — login-401 React #31 crash.
 *
 * The shared `sendError` envelope is `{ success:false, error:{ code, message } }` — an
 * OBJECT. When a client renders `data.error` directly into JSX (login.tsx:43 and four
 * sibling pages), an object child throws React #31 → the whole-app ErrorBoundary trips.
 * The api.ts interceptor normalizes `data.error` to a string EXCEPT when `.message` is
 * absent, and unit / interceptor-bypassed paths skip it entirely (codex review). These
 * tests pin the *page* behavior: a failed login must render a STRING, never an object.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'

jest.mock('@/lib/api', () => ({
  api: { post: jest.fn() },
}))

import { api } from '@/lib/api'
import Login from '@/pages/login'
import { getErrorMessage } from '@/lib/errors'

const mockPost = api.post as unknown as jest.Mock

function fillAndSubmit() {
  const { container } = render(<Login />)
  const email = container.querySelector('input[type="email"]') as HTMLInputElement
  const password = container.querySelector('input[type="password"]') as HTMLInputElement
  fireEvent.change(email, { target: { value: 'aisha@test.com' } })
  fireEvent.change(password, { target: { value: 'password123' } })
  fireEvent.submit(container.querySelector('form') as HTMLFormElement)
}

describe('Sprint 93: login renders a string error, never an object (React #31 guard)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the message string when the error envelope is { code, message }', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 401, data: { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } } },
    })
    fillAndSubmit()
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('renders a non-empty string (no object child) when the error has no .message', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 401, data: { success: false, error: { code: 'UNAUTHORIZED' } } },
    })
    fillAndSubmit()
    // The invariant: a STRING is shown and React did not throw #31 (which would crash the
    // render before any assertion could pass). The fixed code surfaces the code string.
    await waitFor(() => {
      expect(screen.getByText('UNAUTHORIZED')).toBeInTheDocument()
    })
  })
})

describe('Sprint 93: getErrorMessage coerces any API error shape to a non-empty string', () => {
  it('prefers error.message from the { code, message } envelope', () => {
    expect(getErrorMessage({ response: { data: { error: { code: 'X', message: 'Invalid credentials' } } } }))
      .toBe('Invalid credentials')
  })

  it('falls back to error.code when message is absent (the interceptor-gap shape)', () => {
    expect(getErrorMessage({ response: { data: { error: { code: 'UNAUTHORIZED' } } } }))
      .toBe('UNAUTHORIZED')
  })

  it('passes through a string error', () => {
    expect(getErrorMessage({ response: { data: { error: 'plain string error' } } }))
      .toBe('plain string error')
  })

  it('uses the top-level message when there is no error field', () => {
    expect(getErrorMessage({ response: { data: { message: 'top-level message' } } }))
      .toBe('top-level message')
  })

  it('uses err.message for network-style errors', () => {
    expect(getErrorMessage({ message: 'Network Error' })).toBe('Network Error')
  })

  it('returns the fallback for an empty message and for an unknown shape', () => {
    expect(getErrorMessage({ response: { data: { error: { message: '' } } } }, 'fb')).toBe('fb')
    expect(getErrorMessage({}, 'nothing useful')).toBe('nothing useful')
  })

  it('never returns an object (React #31 guard)', () => {
    expect(typeof getErrorMessage({ response: { data: { error: { code: 'X' } } } })).toBe('string')
  })
})
