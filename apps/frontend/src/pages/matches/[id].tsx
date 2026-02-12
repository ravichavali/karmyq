import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { requestService } from '../../lib/api'

export default function MatchRedirectPage() {
  const router = useRouter()
  const { id } = router.query
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMatchAndRedirect = async () => {
      if (!id || typeof id !== 'string') return

      try {
        // Fetch the match to get the request_id
        const response = await requestService.getMatch(id)
        const match = response.data.data

        // Redirect to the request detail page
        router.replace(`/requests/${match.request_id}`)
      } catch (err: any) {
        console.error('Error fetching match:', err)
        setError('Match not found')
      }
    }

    fetchMatchAndRedirect()
  }, [id, router])

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light via-surface-raised to-accent-light flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text mb-4">Match Not Found</h1>
          <p className="text-text-muted mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-surface-raised to-accent-light flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-text-muted mt-4">Redirecting to request...</p>
      </div>
    </div>
  )
}
