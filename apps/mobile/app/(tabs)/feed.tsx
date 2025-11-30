import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { api } from '@/services/api'
import { useAuthStore } from '@/store/auth'
import QuickCreate from '@/components/QuickCreate'
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

interface FeedItem {
  type: 'request'
  priority: 'my_requests_matched' | 'accepted_offers' | 'community' | 'global'
  request: HelpRequest
  matches?: Match[]
  canAcceptDecline: boolean
  canMarkComplete: boolean
  showChat: boolean
}

export default function FeedScreen() {
  const { user } = useAuthStore()
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())
  const [chatVisible, setChatVisible] = useState<{ [key: string]: boolean }>({})

  const loadFeed = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)

      // Fetch all data in parallel
      const [myRequestsRes, allMatchesRes, communityRequestsRes] = await Promise.all([
        api.getRequests({ requester_id: user.id, limit: 50 }),
        api.getMatches({ limit: 100 }),
        api.getRequests({ status: 'open', limit: 50 }),
      ])

      const myRequests = myRequestsRes.data.data || []
      const allMatches = allMatchesRes.data.data || []
      const communityRequests = communityRequestsRes.data.data || []

      // Build unified feed
      const feed: FeedItem[] = []

      // PRIORITY 1: My Requests with Offers (Amber)
      const myRequestsMatched = myRequests.filter(
        (r: HelpRequest) => r.status === 'matched' || r.status === 'in_progress'
      )

      myRequestsMatched.forEach((request: HelpRequest) => {
        const requestMatches = allMatches.filter((m: Match) => m.request_id === request.id)

        feed.push({
          type: 'request',
          priority: 'my_requests_matched',
          request,
          matches: requestMatches,
          canAcceptDecline: true, // I'm the requester
          canMarkComplete: requestMatches.some((m: Match) => m.status === 'accepted'),
          showChat: false,
        })
      })

      // PRIORITY 2: Offers I'm Helping With (Green)
      const myAcceptedOffers = allMatches.filter(
        (m: Match) => m.responder_id === user.id && (m.status === 'accepted' || m.status === 'in_progress')
      )

      for (const match of myAcceptedOffers) {
        // Find the request
        const request = myRequests.find((r: HelpRequest) => r.id === match.request_id) ||
          communityRequests.find((r: HelpRequest) => r.id === match.request_id)

        if (request) {
          feed.push({
            type: 'request',
            priority: 'accepted_offers',
            request,
            matches: [match],
            canAcceptDecline: false,
            canMarkComplete: true, // Can mark as complete
            showChat: true, // Show inline chat
          })
        }
      }

      // PRIORITY 3: Community Requests (Blue)
      const openCommunityRequests = communityRequests.filter(
        (r: HelpRequest) =>
          r.status === 'open' &&
          r.requester_id !== user.id && // Not my own request
          !feed.some((item) => item.request.id === r.id) // Not already in feed
      )

      openCommunityRequests.forEach((request: HelpRequest) => {
        feed.push({
          type: 'request',
          priority: 'community',
          request,
          matches: [],
          canAcceptDecline: false,
          canMarkComplete: false,
          showChat: false,
        })
      })

      setFeedItems(feed)
    } catch (error) {
      console.error('Failed to load feed:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  const onRefresh = () => {
    setRefreshing(true)
    loadFeed()
  }

  const toggleExpanded = (requestId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev)
      if (next.has(requestId)) {
        next.delete(requestId)
      } else {
        next.add(requestId)
      }
      return next
    })
  }

  const toggleChat = (matchId: string) => {
    setChatVisible((prev) => ({
      ...prev,
      [matchId]: !prev[matchId],
    }))
  }

  const handleAcceptMatch = async (matchId: string) => {
    if (!user?.id) return

    try {
      await api.acceptMatch(matchId, user.id)
      Alert.alert('Success', 'Offer accepted!')
      loadFeed() // Refresh
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
              loadFeed()
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
              loadFeed()
            } catch (error) {
              console.error('Failed to mark complete:', error)
              Alert.alert('Error', 'Failed to mark complete')
            }
          },
        },
      ]
    )
  }

  const getPriorityColor = (priority: FeedItem['priority']) => {
    switch (priority) {
      case 'my_requests_matched':
        return '#F59E0B' // Amber
      case 'accepted_offers':
        return '#10B981' // Green
      case 'community':
        return '#3B82F6' // Blue
      case 'global':
        return '#6B7280' // Gray
    }
  }

  const getPriorityLabel = (priority: FeedItem['priority']) => {
    switch (priority) {
      case 'my_requests_matched':
        return 'MY REQUESTS'
      case 'accepted_offers':
        return 'HELPING'
      case 'community':
        return 'COMMUNITY'
      case 'global':
        return 'GLOBAL'
    }
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

  const renderMatch = (match: Match, item: FeedItem) => (
    <View key={match.id} style={styles.matchCard}>
      <View style={styles.matchHeader}>
        <Ionicons name="person-circle" size={20} color="#3B82F6" />
        <Text style={styles.matchName}>{match.responder_name || 'Helper'}</Text>
        <Text style={styles.matchStatus}>{match.status}</Text>
      </View>

      {match.message && (
        <Text style={styles.matchMessage}>{match.message}</Text>
      )}

      {/* Action Buttons */}
      {item.canAcceptDecline && match.status === 'proposed' && (
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

      {/* Inline Chat */}
      {item.showChat && match.status === 'accepted' && user && (
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
  )

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    const isExpanded = expandedPosts.has(item.request.id)
    const hasMatches = item.matches && item.matches.length > 0

    return (
      <View style={[styles.feedCard, { borderLeftColor: getPriorityColor(item.priority) }]}>
        {/* Priority Badge */}
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
          <Text style={styles.priorityText}>{getPriorityLabel(item.priority)}</Text>
        </View>

        {/* Request Header */}
        <TouchableOpacity
          onPress={() => router.push(`/requests/${item.request.id}` as any)}
          activeOpacity={0.7}
        >
          <View style={styles.requestHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.request.status) }]}>
              <Text style={styles.statusText}>{item.request.status}</Text>
            </View>
            <Text style={styles.category}>{item.request.category}</Text>
          </View>

          <Text style={styles.requestDescription} numberOfLines={isExpanded ? undefined : 3}>
            {item.request.description}
          </Text>

          <View style={styles.requestFooter}>
            <View style={styles.requesterInfo}>
              <Ionicons name="person-circle" size={16} color="#9CA3AF" />
              <Text style={styles.requesterName}>{item.request.requester_name || 'Someone'}</Text>
            </View>
            {item.request.community_name && (
              <Text style={styles.communityName}>{item.request.community_name}</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Show Offers (Matches) */}
        {hasMatches && (
          <View style={styles.matchesSection}>
            <TouchableOpacity
              style={styles.matchesToggle}
              onPress={() => toggleExpanded(item.request.id)}
            >
              <Text style={styles.matchesToggleText}>
                {item.matches!.length} {item.matches!.length === 1 ? 'Offer' : 'Offers'}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>

            {isExpanded && item.matches!.map((match) => renderMatch(match, item))}
          </View>
        )}

        {/* Mark Complete Button */}
        {item.canMarkComplete && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => {
              const match = item.matches?.[0]
              if (match) handleMarkComplete(match.id)
            }}
          >
            <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
            <Text style={styles.completeButtonText}>Mark Complete</Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="hand-right-outline" size={64} color="#9CA3AF" />
      <Text style={styles.emptyStateTitle}>No Requests Yet</Text>
      <Text style={styles.emptyStateText}>
        Create your first help request above!
      </Text>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feedItems}
        renderItem={renderFeedItem}
        keyExtractor={(item) => `${item.priority}-${item.request.id}`}
        ListHeaderComponent={user ? <QuickCreate userId={user.id} onRequestCreated={loadFeed} /> : null}
        ListEmptyComponent={renderEmptyState}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={feedItems.length === 0 ? styles.emptyList : styles.list}
      />
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
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
    padding: 16,
  },
  feedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  requestDescription: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
    marginBottom: 12,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requesterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requesterName: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  communityName: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  matchesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  matchesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  matchesToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  matchCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  matchStatus: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  matchMessage: {
    fontSize: 14,
    color: '#6B7280',
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
  completeButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
})
