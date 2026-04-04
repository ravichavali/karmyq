import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth";

interface KarmaData {
  total_karma: number;
  by_community: {
    community_id: string;
    community_name: string;
    total_karma: string;
  }[];
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [karmaData, setKarmaData] = useState<KarmaData | null>(null);
  const [_loading, setLoading] = useState(true);

  const loadKarma = async () => {
    if (!user) return;
    try {
      const response = await api.getKarma(user.id);
      setKarmaData(response.data.data);
    } catch (error) {
      console.error("Failed to load karma:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKarma();
  }, [user]);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="star" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{karmaData?.total_karma || 0}</Text>
          <Text style={styles.statLabel}>Total Karma</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="people" size={24} color="#10B981" />
          <Text style={styles.statValue}>
            {karmaData?.by_community?.length || 0}
          </Text>
          <Text style={styles.statLabel}>Communities</Text>
        </View>
      </View>

      {karmaData?.by_community && karmaData.by_community.length > 0 && (
        <View style={styles.communitySection}>
          <Text style={styles.sectionTitle}>Karma by Community</Text>
          {karmaData.by_community.map((item) => (
            <View key={item.community_id} style={styles.communityItem}>
              <Text style={styles.communityName}>
                {item.community_name || "Unknown"}
              </Text>
              <Text style={styles.communityKarma}>
                {item.total_karma} karma
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.menuSection}>
        <Text style={styles.menuTitle}>Settings</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="person-outline" size={24} color="#6B7280" />
          <Text style={styles.menuItemText}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="notifications-outline" size={24} color="#6B7280" />
          <Text style={styles.menuItemText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="lock-closed-outline" size={24} color="#6B7280" />
          <Text style={styles.menuItemText}>Privacy</Text>
          <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="help-circle-outline" size={24} color="#6B7280" />
          <Text style={styles.menuItemText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Karmyq v1.0.0</Text>
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
  header: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#FFFFFF",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  userEmail: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  communitySection: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  communityItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  communityName: {
    fontSize: 14,
    color: "#374151",
  },
  communityKarma: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F59E0B",
  },
  menuSection: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: "uppercase",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
    marginLeft: 8,
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 32,
  },
});
