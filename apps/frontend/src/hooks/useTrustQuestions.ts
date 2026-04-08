import { useState, useEffect } from 'react'
import { trustQuestionsService } from '@/lib/api'
import type { TrustQuestion } from '@/lib/answersToConfig'

export function useTrustQuestions() {
  const [questions, setQuestions] = useState<TrustQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    trustQuestionsService.list()
      .then(res => setQuestions(res.data.questions))
      .catch(err => setError(err.message ?? 'Failed to load questions'))
      .finally(() => setLoading(false))
  }, [])

  return { questions, loading, error }
}
