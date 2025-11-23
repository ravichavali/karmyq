import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/auth';

interface HelpRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  community_name: string;
  requester_name: string;
  created_at: string;
}

export default function RequestsScreen() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'mine'>('all');

  const loadRequests = async () => {
    if (!user) return;
    try {
      const params: any = {};
      if (filter === 'open') params.status = 'open';
      if (filter === 'mine') params.requester_id = user.id;

      const response = await api.getRequests(params);
      setRequests(response.data || []);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [user, filter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#10B981';
      case 'matched': return '#3B82F6';
      case 'in_progress': return '#F59E0B';
      case 'completed': return '#6B7280';
      default: return '#9CA3AF';
    }
  };

  const renderRequest = ({ item }: { item: HelpRequest }) => (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => router.push(`/requests/${item.id}`)}
    >
      <View style={styles.requestHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
        <Text style={styles.category}>{item.category}</Text>
      </View>
      <Text style={styles.requestTitle}>{item.title}</Text>
      {item.description && (
        <Text style={styles.requestDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      <View style={styles.requestFooter}>
        <View style={styles.requesterInfo}>
          <Ionicons name="person-circle" size={16} color="#9CA3AF" />
          <Text style={styles.requesterName}>{item.requester_name}</Text>
        </View>
        <Text style={styles.communityName}>{item.community_name}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="hand-right-outline" size={64} color="#9CA3AF" />
      <Text style={styles.emptyStateTitle}>No Requests Found</Text>
      <Text style={styles.emptyStateText}>
        {filter === 'mine'
          ? "You haven't created any help requests yet"
          : 'No help requests available at the moment'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        {(['all', 'open', 'mine'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'My Requests'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={requests.length === 0 ? styles.emptyList : styles.list}
      />
    </View>
  );
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
  filterBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  requestCard: {
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
  requestTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  requestDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
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
  emptyList: {
    flexGrow: 1,
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
});
