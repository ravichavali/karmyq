import { useState } from 'react'
import { QUESTIONS, QuestionnaireAnswers } from '@/lib/trust-model'

interface CommunityTrustQuestionnaireProps {
  onComplete: (answers: QuestionnaireAnswers) => void
  onBack?: () => void
  initialAnswers?: Partial<QuestionnaireAnswers>
  mode?: 'create' | 'revisit'
}

export default function CommunityTrustQuestionnaire({
  onComplete,
  onBack,
  initialAnswers = {},
  mode = 'create',
}: CommunityTrustQuestionnaireProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Partial<QuestionnaireAnswers>>(initialAnswers)
  const [advancing, setAdvancing] = useState(false)

  const question = QUESTIONS[currentIndex]
  const totalQuestions = QUESTIONS.length
  const currentAnswer = answers[question.id]

  function handleSelect(value: string) {
    if (advancing) return

    const updated = { ...answers, [question.id]: value } as Partial<QuestionnaireAnswers>
    setAnswers(updated)
    setAdvancing(true)

    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(currentIndex + 1)
        setAdvancing(false)
      } else {
        // All answered — fire onComplete
        onComplete(updated as QuestionnaireAnswers)
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
    // Only allow navigating to already-answered questions
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
        {QUESTIONS.map((q, i) => (
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
        <h3 className="text-lg font-semibold text-text mb-1">{question.text}</h3>
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
                    <p className="text-sm text-text-muted mt-0.5">{choice.description}</p>
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
