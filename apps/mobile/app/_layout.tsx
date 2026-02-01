import { Stack } from "expo-router";
import { useEffect } from "react";
import {
  registerForPushNotificationsAsync,
  setupNotificationHandlers,
} from "@/services/notifications";
import { useAuthStore } from "@/store/auth";

export default function RootLayout() {
  const { user, checkAuth } = useAuthStore();

  // Check for existing auth session on app start
  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      // Register for push notifications when user logs in
      registerForPushNotificationsAsync();
      setupNotificationHandlers();
    }
  }, [user]);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#3B82F6",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(auth)"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
