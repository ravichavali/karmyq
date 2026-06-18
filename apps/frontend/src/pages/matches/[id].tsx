import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { requestService } from '../../lib/api'
import EmptyState from '@/components/EmptyState'

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
        console.error('Error fetching match', { error: err instanceof Error ? err.message : String(err) })
        setError('Match not found')
      }
    }

    fetchMatchAndRedirect()
  }, [id, router])

  if (error) {
    return (
      <main className="kq-page py-10">
        <EmptyState
          heading="Match not found"
          body={error}
          ctaLabel="Go to Dashboard"
          ctaOnClick={() => router.push('/dashboard')}
        />
      </main>
    )
  }

  return (
    <main className="kq-page py-10">
      <div className="kq-card text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-text-muted mt-4">Redirecting to request...</p>
      </div>
    </main>
  )
}
