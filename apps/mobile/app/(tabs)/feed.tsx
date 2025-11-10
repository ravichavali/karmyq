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

interface FeedItem {
  id: string;
  type: string;
  data: any;
  created_at: string;
}

export default function FeedScreen() {
  const { user } = useAuthStore();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = async () => {
    if (!user) return;

    try {
      const response = await api.getFeed(user.id);
      setFeedItems(response.data.items || []);
    } catch (error) {
      console.error('Failed to load feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    return (
      <TouchableOpacity
        style={styles.feedItem}
        onPress={() => {
          // Navigate to detail screen based on item type
          if (item.type === 'open_request') {
            router.push(`/requests/${item.data.request_id}`);
          }
        }}
      >
        <View style={styles.feedItemHeader}>
          <Ionicons
            name={getFeedItemIcon(item.type)}
            size={24}
            color="#3B82F6"
          />
          <Text style={styles.feedItemType}>{item.type.replace('_', ' ')}</Text>
        </View>
        <Text style={styles.feedItemTitle}>
          {item.data.title || item.data.description}
        </Text>
        {item.data.community_name && (
          <Text style={styles.feedItemCommunity}>
            {item.data.community_name}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="newspaper-outline" size={64} color="#9CA3AF" />
      <Text style={styles.emptyStateTitle}>Your feed is empty</Text>
      <Text style={styles.emptyStateText}>
        Join communities and start helping to see activity here!
      </Text>
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={() => router.push('/(tabs)/communities')}
      >
        <Text style={styles.emptyStateButtonText}>Explore Communities</Text>
      </TouchableOpacity>
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
      <FlatList
        data={feedItems}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={feedItems.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

function getFeedItemIcon(type: string): any {
  switch (type) {
    case 'community_activity':
      return 'people';
    case 'open_request':
      return 'hand-right';
    case 'suggested_request':
      return 'bulb';
    case 'story':
      return 'trophy';
    default:
      return 'information-circle';
  }
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
  feedItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  feedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedItemType: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  feedItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  feedItemCommunity: {
    fontSize: 14,
    color: '#6B7280',
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
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
