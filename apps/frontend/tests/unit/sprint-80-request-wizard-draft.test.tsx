/**
 * Sprint 80 — RequestWizard draft-loss protection.
 *
 * Covers handleAttemptClose in src/components/RequestWizard.tsx (wired to the
 * backdrop and the X button):
 *   - no draft    → close immediately, no confirm prompt
 *   - has draft   → confirm before discarding; honor the user's choice
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

jest.mock('@/lib/api', () => ({
  requestService: {
    getSchemas: jest.fn().mockResolvedValue({ data: { schemas: [] } }),
    getSchema: jest.fn().mockResolvedValue({ data: { schema: null } }),
    createRequest: jest.fn(),
  },
  communityService: { getMyCommunities: jest.fn().mockResolvedValue({ data: { communities: [] } }) },
  dibsService: { getDibsCandidate: jest.fn(), sendDibs: jest.fn() },
}))
jest.mock('@/components/requests/DynamicForm', () => () => null)
jest.mock('@/components/requests/DibsPrompt', () => ({ __esModule: true, default: () => null }))

import RequestWizard from '@/components/RequestWizard'

async function renderWizard(onClose: () => void) {
  await act(async () => {
    render(<RequestWizard onClose={onClose} />)
  })
}

describe('Sprint 80 — RequestWizard draft protection', () => {
  let confirmSpy: jest.SpyInstance

  beforeEach(() => {
    localStorage.clear()
    confirmSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true)
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  it('closes immediately without confirming when there is no draft', async () => {
    const onClose = jest.fn()
    await renderWizard(onClose)

    fireEvent.click(screen.getByLabelText('Close'))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks for confirmation and closes when the user accepts the discard', async () => {
    const onClose = jest.fn()
    await renderWizard(onClose)

    // Selecting a request type creates a draft.
    fireEvent.click(screen.getByText('General'))
    confirmSpy.mockReturnValue(true)

    fireEvent.click(screen.getByLabelText('Close'))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the wizard open when the user cancels the discard', async () => {
    const onClose = jest.fn()
    await renderWizard(onClose)

    fireEvent.click(screen.getByText('General'))
    confirmSpy.mockReturnValue(false)

    fireEvent.click(screen.getByLabelText('Close'))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('protects a draft when the backdrop is clicked', async () => {
    const onClose = jest.fn()
    await renderWizard(onClose)

    fireEvent.click(screen.getByText('General'))
    confirmSpy.mockReturnValue(false)

    // Select the backdrop by its stable test id (not a CSS-class string).
    fireEvent.click(screen.getByTestId('request-wizard-backdrop'))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})
