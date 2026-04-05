import { useState } from 'react'
import { useTrustQuestions } from '@/hooks/useTrustQuestions'
import { answersToConfig } from '@/lib/answersToConfig'
import type { TrustQuestionnaireAnswers } from '@/lib/trust-model'
import type { CommunityConfig } from '@/types/community-config'

interface CommunityTrustQuestionnaireProps {
  onComplete: (config: Partial<CommunityConfig>) => void
  onBack?: () => void
  initialAnswers?: TrustQuestionnaireAnswers
  mode?: 'create' | 'revisit'
}

export default function CommunityTrustQuestionnaire({
  onComplete,
  onBack,
  initialAnswers = {},
  mode = 'create',
}: CommunityTrustQuestionnaireProps) {
  const { questions, loading, error } = useTrustQuestions()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<TrustQuestionnaireAnswers>(initialAnswers)
  const [advancing, setAdvancing] = useState(false)

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="h-3 w-32 rounded bg-surface-raised animate-pulse mb-2" />
          <div className="h-6 w-64 rounded bg-surface-raised animate-pulse mb-1" />
          <div className="h-4 w-80 rounded bg-surface-raised animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border-2 border-border bg-surface-raised h-20 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || questions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-sm text-text-muted">
          {error ?? 'No questions available. Please try again.'}
        </p>
      </div>
    )
  }

  const question = questions[currentIndex]
  const totalQuestions = questions.length
  const currentAnswer = answers[question.id]

  function handleSelect(value: string) {
    if (advancing) return

    const updated: TrustQuestionnaireAnswers = { ...answers, [question.id]: value }
    setAnswers(updated)
    setAdvancing(true)

    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(currentIndex + 1)
        setAdvancing(false)
      } else {
        onComplete(answersToConfig(questions, updated))
      }
    }, 200)
  }

  function handleBack() {
    if (currentIndex === 0) {
      onBack?.()
    } else {
      setCurrentIndex(currentIndex - 1)
      setAdvancing(false)
    }
  }

  function handleDotClick(index: number) {
    if (index < currentIndex) {
      setCurrentIndex(index)
      setAdvancing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-1">
          {mode === 'create' ? 'Step 2 of 3 — Trust Model' : 'Revisit Your Trust Model'}
        </p>
        <h2 className="text-xl font-bold text-text">
          {mode === 'create' ? 'How does your community work?' : 'How has your community evolved?'}
        </h2>
        <p className="text-sm text-text-muted mt-1">
          Your answers shape the numbers behind the scenes — karma splits, trust paths, new member gates.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => handleDotClick(i)}
            aria-label={`Question ${i + 1}`}
            className={[
              'h-2 rounded-full transition-all duration-200',
              i === currentIndex
                ? 'w-6 bg-primary'
                : i < currentIndex
                ? 'w-2 bg-primary/50 cursor-pointer hover:bg-primary/70'
                : 'w-2 bg-border',
            ].join(' ')}
          />
        ))}
        <span className="ml-2 text-xs text-text-muted">
          {currentIndex + 1} of {totalQuestions}
        </span>
      </div>

      {/* Question */}
      <div>
        <h3 className="text-lg font-semibold text-text mb-1">{question.question_text}</h3>
        {question.subtext && (
          <p className="text-sm text-text-muted mb-4">{question.subtext}</p>
        )}

        <div className="space-y-3">
          {question.choices.map((choice) => {
            const selected = currentAnswer === choice.value
            return (
              <button
                key={choice.value}
                onClick={() => handleSelect(choice.value)}
                disabled={advancing}
                className={[
                  'w-full text-left rounded-lg border-2 p-4 transition-all duration-150',
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-surface-raised hover:border-primary/40 hover:bg-surface',
                  advancing && !selected ? 'opacity-50' : '',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      'mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                      selected ? 'border-primary bg-primary' : 'border-border',
                    ].join(' ')}
                  >
                    {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="font-medium text-text">{choice.label}</p>
                    {choice.description && (
                      <p className="text-sm text-text-muted mt-0.5">{choice.description}</p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Back button */}
      <div className="pt-2">
        <button
          onClick={handleBack}
          className="text-sm text-text-muted hover:text-text transition-colors"
        >
          ← {currentIndex === 0 ? 'Back to basics' : 'Previous question'}
        </button>
      </div>
    </div>
  )
}
