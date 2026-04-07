import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CommunityTrustQuestionnaire from '../../src/components/CommunityTrustQuestionnaire'

jest.useFakeTimers()

// Mock the hook instead of the removed trust-model exports
const mockQuestions = [
  {
    id: 'q1',
    question_text: 'How open is your community to new members?',
    subtext: null,
    display_order: 10,
    choices: [
      { value: 'open', label: 'Open to all', description: 'Anyone can join', config_delta: {} },
      { value: 'gated', label: 'Application required', description: 'Members apply first', config_delta: {} },
    ],
  },
  {
    id: 'q2',
    question_text: 'How should help requests be approved?',
    subtext: 'This affects your approval workflow.',
    display_order: 20,
    choices: [
      { value: 'auto', label: 'Automatic', description: 'No approval needed', config_delta: {} },
      { value: 'manual', label: 'Manual review', description: 'Admin approves each', config_delta: {} },
    ],
  },
]

jest.mock('../../src/hooks/useTrustQuestions', () => ({
  useTrustQuestions: () => ({
    questions: mockQuestions,
    loading: false,
    error: null,
  }),
}))

const noop = jest.fn()

describe('CommunityTrustQuestionnaire (data-driven)', () => {
  beforeEach(() => {
    noop.mockClear()
  })

  it('renders the first question from the API response', () => {
    render(<CommunityTrustQuestionnaire onComplete={noop} />)
    expect(screen.getByText(mockQuestions[0].question_text)).toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('shows the second question after selecting an answer (200ms delay)', () => {
    render(<CommunityTrustQuestionnaire onComplete={noop} />)
    fireEvent.click(screen.getByText(mockQuestions[0].choices[0].label))
    act(() => { jest.advanceTimersByTime(200) })
    expect(screen.getByText(mockQuestions[1].question_text)).toBeInTheDocument()
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
  })

  it('calls onComplete after all questions are answered', () => {
    render(<CommunityTrustQuestionnaire onComplete={noop} />)
    fireEvent.click(screen.getByText(mockQuestions[0].choices[0].label))
    act(() => { jest.advanceTimersByTime(200) })
    expect(noop).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(mockQuestions[1].choices[0].label))
    act(() => { jest.advanceTimersByTime(200) })
    expect(noop).toHaveBeenCalledTimes(1)
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
    fireEvent.click(screen.getByText(mockQuestions[0].choices[0].label))
    act(() => { jest.advanceTimersByTime(200) })
    fireEvent.click(screen.getByText(/previous question/i))
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.getByText(mockQuestions[0].question_text)).toBeInTheDocument()
  })
})
