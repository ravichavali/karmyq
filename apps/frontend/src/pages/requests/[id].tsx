import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { requestService, messagingService } from '../../lib/api'
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

interface HelpOffer {
  id: string
  offerer_id: string
  helper_name: string
  title: string
  description: string
  category: string
  status: string
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
  const [availableOffers, setAvailableOffers] = useState<HelpOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [showOfferModal, setShowOfferModal] = useState(false)
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
      fetchAvailableOffers()
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

  const fetchAvailableOffers = async () => {
    if (!request) return

    try {
      const response = await requestService.getOffers({
        community_id: request.community_id,
        status: 'active',
        type: request.category,
      })
      setAvailableOffers(response.data.data)
    } catch (error) {
      console.error('Error fetching offers:', error)
    }
  }

  const handleRespondToRequest = async (offerId?: string) => {
    if (!currentUser || !request) return

    try {
      setResponding(true)
      await requestService.createMatch({
        request_id: request.id,
        offer_id: offerId,
        responder_id: currentUser.id,
      })

      alert('Response submitted successfully!')
      setShowOfferModal(false)
      await fetchRequest()
      await fetchMatches()
    } catch (error: any) {
      console.error('Error responding to request:', error)
      alert(error.response?.data?.message || 'Failed to respond to request')
    } finally {
      setResponding(false)
    }
  }

  const handleCompleteMatch = async (matchId: string) => {
    if (!currentUser) return

    try {
      await requestService.completeMatch(matchId, currentUser.id)
      alert('Match marked as completed!')
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
      alert('Match cancelled successfully!')
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading request...</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Request not found</p>
          <Link href="/requests" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to requests
          </Link>
        </div>
      </div>
    )
  }

  const canRespond = request.status === 'open' && currentUser && currentUser.id !== request.requester_id

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link href="/requests" className="text-blue-600 hover:underline mb-6 inline-block">
          ← Back to requests
        </Link>

        {/* Request Details */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
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
            <p className="text-gray-700 whitespace-pre-wrap">{request.description}</p>
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

          {canRespond && (
            <div className="mt-6 pt-6 border-t">
              <button
                onClick={() => setShowOfferModal(true)}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                Offer to Help
              </button>
            </div>
          )}
        </div>

        {/* Matches Section */}
        {matches.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Responses</h2>
            <div className="space-y-4">
              {matches.map((match) => (
                <div key={match.id} className="border rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{match.helper_name}</h3>
                      <p className="text-gray-600 text-sm">{match.helper_email}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(match.status)}`}>
                      {match.status}
                    </span>
                  </div>

                  <div className="text-sm text-gray-500 mb-4">
                    Responded on {new Date(match.created_at).toLocaleDateString()}
                    {match.completed_at && (
                      <span> • Completed on {new Date(match.completed_at).toLocaleDateString()}</span>
                    )}
                  </div>

                  {currentUser && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleStartConversation(match)}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M2 2h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4l-3 3V3a1 1 0 0 1 1-1z" />
                        </svg>
                        Message
                      </button>

                      {match.status === 'proposed' && (
                        <>
                          <button
                            onClick={() => handleCompleteMatch(match.id)}
                            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => handleCancelMatch(match.id)}
                            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Offer Selection Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Offer to Help</h2>

            {availableOffers.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Use an existing offer:</h3>
                <div className="space-y-3">
                  {availableOffers.map((offer) => (
                    <button
                      key={offer.id}
                      onClick={() => handleRespondToRequest(offer.id)}
                      disabled={responding}
                      className="w-full text-left border border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50"
                    >
                      <h4 className="font-semibold text-gray-900">{offer.title}</h4>
                      <p className="text-gray-600 text-sm mt-1">{offer.description}</p>
                    </button>
                  ))}
                </div>
                <div className="my-6 text-center text-gray-500">or</div>
              </div>
            )}

            <button
              onClick={() => handleRespondToRequest()}
              disabled={responding}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
            >
              {responding ? 'Submitting...' : 'Respond without an existing offer'}
            </button>

            <button
              onClick={() => setShowOfferModal(false)}
              className="w-full mt-3 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
