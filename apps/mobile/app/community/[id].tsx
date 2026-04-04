import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth";

interface CommunityDetail {
  id: string;
  name: string;
  description: string;
  current_members: number;
  max_members: number;
  access_type: "public" | "private";
  created_at: string;
  is_member?: boolean;
}

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: _user } = useAuthStore();
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const loadCommunity = async () => {
    if (!id) return;
    try {
      const response = await api.getCommunity(id);
      setCommunity(response.data.data);
    } catch (error) {
      console.error("Failed to load community:", error);
      Alert.alert("Error", "Failed to load community details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunity();
  }, [id]);

  const handleJoinCommunity = async () => {
    if (!id || !community) return;

    setJoining(true);
    try {
      await api.joinCommunity(id);
      Alert.alert("Success", `You have joined ${community.name}!`);
      loadCommunity(); // Reload to update membership status
    } catch (error: any) {
      console.error("Failed to join community:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to join community",
      );
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveCommunity = async () => {
    if (!id || !community) return;

    Alert.alert(
      "Leave Community",
      `Are you sure you want to leave ${community.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setJoining(true);
            try {
              await api.leaveCommunity(id);
              Alert.alert("Success", `You have left ${community.name}`);
              loadCommunity(); // Reload to update membership status
            } catch (error: any) {
              console.error("Failed to leave community:", error);
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to leave community",
              );
            } finally {
              setJoining(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#9CA3AF" />
        <Text style={styles.errorText}>Community not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="people" size={48} color="#3B82F6" />
        </View>
        <Text style={styles.communityName}>{community.name}</Text>
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Ionicons
              name={
                community.access_type === "private" ? "lock-closed" : "globe"
              }
              size={16}
              color="#6B7280"
            />
            <Text style={styles.metaText}>
              {community.access_type === "private" ? "Private" : "Public"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={16} color="#6B7280" />
            <Text style={styles.metaText}>
              {community.current_members}/{community.max_members} members
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.memberProgress}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(community.current_members / community.max_members) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {community.max_members - community.current_members} spots remaining
        </Text>
      </View>

      {community.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{community.description}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Community Info</Text>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Created {new Date(community.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={styles.actionContainer}>
        {community.is_member ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.leaveButton]}
            onPress={handleLeaveCommunity}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color="#EF4444" />
                <Text style={styles.leaveButtonText}>Leave Community</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.joinButton]}
            onPress={handleJoinCommunity}
            disabled={
              joining || community.current_members >= community.max_members
            }
          >
            {joining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.joinButtonText}>
                  {community.current_members >= community.max_members
                    ? "Community Full"
                    : "Join Community"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#3B82F6",
    borderRadius: 8,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    backgroundColor: "#FFFFFF",
    padding: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#EBF5FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  communityName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: "row",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: "#6B7280",
  },
  memberProgress: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginTop: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },
  section: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#6B7280",
  },
  actionContainer: {
    padding: 16,
    marginTop: 12,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  joinButton: {
    backgroundColor: "#3B82F6",
  },
  joinButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  leaveButton: {
    backgroundColor: "#FEE2E2",
  },
  leaveButtonText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
  },
});
