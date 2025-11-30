import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { api } from '@/services/api'
import { useAuthStore } from '@/store/auth'
import InlineChat from '@/components/InlineChat'

interface HelpRequest {
  id: string
  title?: string
  description: string
  category: string
  status: string
  urgency: string
  community_id?: string
  community_name?: string
  requester_id: string
  requester_name?: string
  created_at: string
}

interface Match {
  id: string
  request_id: string
  responder_id: string
  responder_name?: string
  status: string
  message?: string
  created_at: string
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const [request, setRequest] = useState<HelpRequest | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [chatVisible, setChatVisible] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    if (id) {
      loadRequest()
      loadMatches()
    }
  }, [id])

  const loadRequest = async () => {
    try {
      const response = await api.getRequest(id!)
      setRequest(response.data.data || response.data.request)
    } catch (error) {
      console.error('Failed to load request:', error)
      Alert.alert('Error', 'Failed to load request details')
    }
  }

  const loadMatches = async () => {
    try {
      setLoading(true)
      const response = await api.getMatches({ request_id: id })
      setMatches(response.data.data || [])
    } catch (error) {
      console.error('Failed to load matches:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptMatch = async (matchId: string) => {
    if (!user?.id) return

    try {
      await api.acceptMatch(matchId, user.id)
      Alert.alert('Success', 'Offer accepted!')
      loadRequest()
      loadMatches()
    } catch (error) {
      console.error('Failed to accept match:', error)
      Alert.alert('Error', 'Failed to accept offer')
    }
  }

  const handleDeclineMatch = async (matchId: string) => {
    if (!user?.id) return

    Alert.alert(
      'Decline Offer',
      'Are you sure you want to decline this offer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.declineMatch(matchId, user.id)
              loadMatches()
            } catch (error) {
              console.error('Failed to decline match:', error)
              Alert.alert('Error', 'Failed to decline offer')
            }
          },
        },
      ]
    )
  }

  const handleMarkComplete = async (matchId: string) => {
    if (!user?.id) return

    Alert.alert(
      'Mark Complete',
      'Mark this request as complete?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await api.completeMatch(matchId, user.id)
              Alert.alert('Success', 'Request marked as complete!')
              loadRequest()
              loadMatches()
            } catch (error) {
              console.error('Failed to mark complete:', error)
              Alert.alert('Error', 'Failed to mark complete')
            }
          },
        },
      ]
    )
  }

  const toggleChat = (matchId: string) => {
    setChatVisible((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return '#10B981'
      case 'matched':
        return '#F59E0B'
      case 'in_progress':
        return '#3B82F6'
      case 'completed':
        return '#6B7280'
      default:
        return '#9CA3AF'
    }
  }

  const isRequester = user?.id === request?.requester_id
  const acceptedMatches = matches.filter((m) => m.status === 'accepted' || m.status === 'in_progress')
  const canMarkComplete = isRequester && acceptedMatches.length > 0

  if (loading || !request) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Request Card */}
        <View style={styles.requestCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
              <Text style={styles.statusText}>{request.status}</Text>
            </View>
            <Text style={styles.category}>{request.category}</Text>
            <Text style={styles.urgency}>{request.urgency}</Text>
          </View>

          {request.title && <Text style={styles.title}>{request.title}</Text>}

          <Text style={styles.description}>{request.description}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="person-circle" size={16} color="#6B7280" />
              <Text style={styles.metaText}>{request.requester_name || 'Someone'}</Text>
            </View>
            {request.community_name && (
              <View style={styles.metaItem}>
                <Ionicons name="people" size={16} color="#6B7280" />
                <Text style={styles.metaText}>{request.community_name}</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar" size={16} color="#6B7280" />
              <Text style={styles.metaText}>
                {new Date(request.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Offers Section */}
        {matches.length > 0 && (
          <View style={styles.offersSection}>
            <Text style={styles.sectionTitle}>
              Offers ({matches.length})
            </Text>

            {matches.map((match) => (
              <View key={match.id} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <Ionicons name="person-circle" size={24} color="#3B82F6" />
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchName}>
                      {match.responder_name || 'Helper'}
                    </Text>
                    <Text style={styles.matchDate}>
                      {new Date(match.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.matchStatusBadge, { backgroundColor: getStatusColor(match.status) }]}>
                    <Text style={styles.matchStatusText}>{match.status}</Text>
                  </View>
                </View>

                {match.message && (
                  <Text style={styles.matchMessage}>{match.message}</Text>
                )}

                {/* Action Buttons (for requesters only) */}
                {isRequester && match.status === 'proposed' && (
                  <View style={styles.matchActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.acceptButton]}
                      onPress={() => handleAcceptMatch(match.id)}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Accept</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.declineButton]}
                      onPress={() => handleDeclineMatch(match.id)}
                    >
                      <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Inline Chat (for accepted matches) */}
                {(match.status === 'accepted' || match.status === 'in_progress') && user && (
                  <View style={styles.chatContainer}>
                    <TouchableOpacity
                      style={styles.chatToggle}
                      onPress={() => toggleChat(match.id)}
                    >
                      <Ionicons
                        name={chatVisible[match.id] ? 'chatbubbles' : 'chatbubbles-outline'}
                        size={18}
                        color="#3B82F6"
                      />
                      <Text style={styles.chatToggleText}>
                        {chatVisible[match.id] ? 'Hide Chat' : 'Open Chat'}
                      </Text>
                    </TouchableOpacity>

                    {chatVisible[match.id] && (
                      <View style={styles.inlineChatWrapper}>
                        <InlineChat
                          matchId={match.id}
                          currentUserId={user.id}
                          otherParticipantName={match.responder_name || 'Helper'}
                          onClose={() => toggleChat(match.id)}
                        />
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Mark Complete Button */}
        {canMarkComplete && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => {
              const match = acceptedMatches[0]
              if (match) handleMarkComplete(match.id)
            }}
          >
            <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
            <Text style={styles.completeButtonText}>Mark Request Complete</Text>
          </TouchableOpacity>
        )}

        {matches.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="hand-right-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No offers yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  category: {
    fontSize: 12,
    color: '#9CA3AF',
    marginRight: 8,
    textTransform: 'capitalize',
  },
  urgency: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
  },
  offersSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchInfo: {
    flex: 1,
    marginLeft: 12,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  matchDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  matchStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  matchStatusText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  matchMessage: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 12,
  },
  matchActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  declineButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  chatContainer: {
    marginTop: 12,
  },
  chatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  chatToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 6,
  },
  inlineChatWrapper: {
    height: 400,
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  completeButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
})
