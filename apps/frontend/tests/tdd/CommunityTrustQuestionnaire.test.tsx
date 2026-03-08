import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CommunityTrustQuestionnaire from '../../src/components/CommunityTrustQuestionnaire'
import { QUESTIONS } from '../../src/lib/trust-model'

jest.useFakeTimers()

const noop = jest.fn()

describe('CommunityTrustQuestionnaire', () => {
  beforeEach(() => { noop.mockClear() })

  it('renders the first question on mount', () => {
    render(<CommunityTrustQuestionnaire onComplete={noop} />)
    expect(screen.getByText(QUESTIONS[0].text)).toBeInTheDocument()
    expect(screen.getByText('1 of 6')).toBeInTheDocument()
  })

  it('shows Q2 after selecting an answer on Q1 (200ms delay)', () => {
    render(<CommunityTrustQuestionnaire onComplete={noop} />)
    const firstChoice = screen.getByText(QUESTIONS[0].choices[0].label)
    fireEvent.click(firstChoice)
    act(() => { jest.advanceTimersByTime(200) })
    expect(screen.getByText(QUESTIONS[1].text)).toBeInTheDocument()
    expect(screen.getByText('2 of 6')).toBeInTheDocument()
  })

  it('calls onComplete only after all 6 questions are answered', () => {
    render(<CommunityTrustQuestionnaire onComplete={noop} />)
    QUESTIONS.forEach((q, i) => {
      // answer current question with first choice
      fireEvent.click(screen.getByText(q.choices[0].label))
      act(() => { jest.advanceTimersByTime(200) })
      if (i < QUESTIONS.length - 1) {
        expect(noop).not.toHaveBeenCalled()
      }
    })
    expect(noop).toHaveBeenCalledTimes(1)
    expect(noop.mock.calls[0][0]).toHaveProperty('q1')
    expect(noop.mock.calls[0][0]).toHaveProperty('q6')
  })

  it('calls onBack when back button is clicked on Q1', () => {
    const onBack = jest.fn()
    render(<CommunityTrustQuestionnaire onComplete={noop} onBack={onBack} />)
    fireEvent.click(screen.getByText(/back to basics/i))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('navigates back to Q1 from Q2 without calling onBack', () => {
    const onBack = jest.fn()
    render(<CommunityTrustQuestionnaire onComplete={noop} onBack={onBack} />)
    fireEvent.click(screen.getByText(QUESTIONS[0].choices[0].label))
    act(() => { jest.advanceTimersByTime(200) })
    // Now on Q2 — click back
    fireEvent.click(screen.getByText(/previous question/i))
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.getByText(QUESTIONS[0].text)).toBeInTheDocument()
  })
})
