import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "@/services/api";

interface Community {
  id: string;
  name: string;
  description: string;
  current_members: number;
  max_members: number;
  access_type: "public" | "private";
}

export default function CommunitiesScreen() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCommunities = async () => {
    try {
      const response = await api.getCommunities();
      setCommunities(response.data.data || []);
    } catch (error) {
      console.error("Failed to load communities:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadCommunities();
  };

  const renderCommunity = ({ item }: { item: Community }) => (
    <TouchableOpacity
      style={styles.communityCard}
      onPress={() => router.push(`/community/${item.id}`)}
    >
      <View style={styles.communityHeader}>
        <View style={styles.communityIcon}>
          <Ionicons name="people" size={24} color="#3B82F6" />
        </View>
        <View style={styles.communityInfo}>
          <Text style={styles.communityName}>{item.name}</Text>
          <View style={styles.communityMeta}>
            <Ionicons
              name={item.access_type === "private" ? "lock-closed" : "globe"}
              size={12}
              color="#9CA3AF"
            />
            <Text style={styles.communityMetaText}>
              {item.access_type === "private" ? "Private" : "Public"}
            </Text>
            <Text style={styles.memberCount}>
              {item.current_members}/{item.max_members} members
            </Text>
          </View>
        </View>
      </View>
      {item.description && (
        <Text style={styles.communityDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      <View style={styles.memberBar}>
        <View
          style={[
            styles.memberBarFill,
            { width: `${(item.current_members / item.max_members) * 100}%` },
          ]}
        />
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color="#9CA3AF" />
      <Text style={styles.emptyStateTitle}>No Communities Yet</Text>
      <Text style={styles.emptyStateText}>
        Be the first to create a community and start helping!
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
      <FlatList
        data={communities}
        renderItem={renderCommunity}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={
          communities.length === 0 ? styles.emptyList : styles.list
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    padding: 16,
  },
  communityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  communityHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  communityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EBF5FF",
    justifyContent: "center",
    alignItems: "center",
  },
  communityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  communityName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  communityMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  communityMetaText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: 4,
    marginRight: 12,
  },
  memberCount: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  communityDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
    lineHeight: 20,
  },
  memberBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  },
  memberBarFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 2,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
