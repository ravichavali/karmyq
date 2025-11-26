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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Match Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Redirecting to request...</p>
      </div>
    </div>
  )
}
