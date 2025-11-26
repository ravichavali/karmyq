import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { requestService } from '../../lib/api'
import { useMessaging } from '../../contexts/MessagingContext'

interface HelpRequest {
  id: string
  community_id: string
  community_name: string
  requester_id: string
  requester_name: string
  requester_email: string
  title: string
  description: string
  category: string
  urgency: string
  status: string
  created_at: string
  updated_at: string
}

interface Match {
  id: string
  request_id: string
  responder_id: string
  status: string
  created_at: string
  completed_at?: string
  helper_name: string
  helper_email: string
}

export default function RequestDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [request, setRequest] = useState<HelpRequest | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const { createConversation } = useMessaging()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        setCurrentUser(JSON.parse(userStr))
      }
    }
  }, [])

  useEffect(() => {
    if (id) {
      fetchRequest()
      fetchMatches()
    }
  }, [id])

  const fetchRequest = async () => {
    try {
      setLoading(true)
      const response = await requestService.getRequest(id as string)
      setRequest(response.data.data)
    } catch (error) {
      console.error('Error fetching request:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMatches = async () => {
    try {
      const response = await requestService.getMatches({ request_id: id as string })
      setMatches(response.data.data)
    } catch (error) {
      console.error('Error fetching matches:', error)
    }
  }

  const handleOfferToHelp = async () => {
    if (!currentUser || !request) return

    try {
      setResponding(true)
      await requestService.createMatch({
        request_id: request.id,
        responder_id: currentUser.id,
      })

      // Silently refresh - no alert popup
      await fetchRequest()
      await fetchMatches()
    } catch (error: any) {
      console.error('Error responding to request:', error)
      // Only show error if something went wrong
      alert(error.response?.data?.message || 'Failed to respond to request')
    } finally {
      setResponding(false)
    }
  }

  const handleCompleteMatch = async (matchId: string) => {
    if (!currentUser) return

    try {
      await requestService.completeMatch(matchId, currentUser.id)
      // Silently refresh
      await fetchRequest()
      await fetchMatches()
    } catch (error: any) {
      console.error('Error completing match:', error)
      alert(error.response?.data?.message || 'Failed to complete match')
    }
  }

  const handleCancelMatch = async (matchId: string) => {
    if (!currentUser) return
    if (!confirm('Are you sure you want to cancel this match?')) return

    try {
      await requestService.cancelMatch(matchId, currentUser.id)
      // Silently refresh
      await fetchRequest()
      await fetchMatches()
    } catch (error: any) {
      console.error('Error cancelling match:', error)
      alert(error.response?.data?.message || 'Failed to cancel match')
    }
  }

  const handleStartConversation = async (match: Match) => {
    if (!currentUser || !request) return

    try {
      // Create or get conversation for this match
      const participantIds = [request.requester_id, match.responder_id]
      const conversation = await createConversation(match.id, participantIds)

      // Navigate to the conversation
      router.push(`/messages/${conversation.id}`)
    } catch (error: any) {
      console.error('Error starting conversation:', error)
      alert('Failed to start conversation')
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-600 bg-blue-100'
      case 'matched': return 'text-purple-600 bg-purple-100'
      case 'completed': return 'text-green-600 bg-green-100'
      case 'cancelled': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading request...</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Request not found</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const canRespond = request.status === 'open' && currentUser && currentUser.id !== request.requester_id
  const userHasResponded = matches.some(m => m.responder_id === currentUser?.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium mb-6 inline-flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Request Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{request.title}</h1>
              <div className="flex gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getUrgencyColor(request.urgency)}`}>
                  {request.urgency} urgency
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(request.status)}`}>
                  {request.status}
                </span>
              </div>
            </div>
          </div>

          <div className="prose max-w-none mb-6">
            <p className="text-gray-700 text-lg whitespace-pre-wrap leading-relaxed">{request.description}</p>
          </div>

          <div className="border-t pt-6 grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Community</h3>
              <p className="text-gray-900">{request.community_name}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Requester</h3>
              <p className="text-gray-900">{request.requester_name}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Category</h3>
              <p className="text-gray-900 capitalize">{request.category.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">Posted</h3>
              <p className="text-gray-900">{new Date(request.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {canRespond && !userHasResponded && (
            <div className="mt-6 pt-6 border-t">
              <button
                onClick={handleOfferToHelp}
                disabled={responding}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {responding ? 'Offering to Help...' : 'Offer to Help'}
              </button>
            </div>
          )}

          {userHasResponded && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-3 rounded-lg">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">You've offered to help with this request</span>
              </div>
            </div>
          )}
        </div>

        {/* Matches Section */}
        {matches.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {matches.length === 1 ? '1 Response' : `${matches.length} Responses`}
            </h2>
            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.id} className="border border-gray-200 rounded-xl p-6 hover:border-blue-200 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{match.helper_name}</h3>
                      <p className="text-gray-600 text-sm">{match.helper_email}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(match.status)}`}>
                      {match.status}
                    </span>
                  </div>

                  <div className="text-sm text-gray-500 mb-4">
                    Responded on {new Date(match.created_at).toLocaleDateString()}
                    {match.completed_at && (
                      <span className="text-green-600 font-medium"> • Completed on {new Date(match.completed_at).toLocaleDateString()}</span>
                    )}
                  </div>

                  {currentUser && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleStartConversation(match)}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M2 2h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4l-3 3V3a1 1 0 0 1 1-1z" />
                        </svg>
                        Message
                      </button>

                      {match.status === 'proposed' && currentUser.id === request.requester_id && (
                        <button
                          onClick={() => handleCompleteMatch(match.id)}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
                        >
                          Mark Complete
                        </button>
                      )}

                      {match.status === 'proposed' && (currentUser.id === request.requester_id || currentUser.id === match.responder_id) && (
                        <button
                          onClick={() => handleCancelMatch(match.id)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
