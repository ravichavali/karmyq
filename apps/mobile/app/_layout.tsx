import { Stack } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { useExpoNotifications } from "@/hooks/useExpoNotifications";

export default function RootLayout() {
  const { checkAuth } = useAuthStore();

  // Check for existing auth session on app start
  useEffect(() => {
    checkAuth();
  }, []);

  // Register Expo push token and set up foreground notification listener.
  // The hook internally waits for user.id before registering — safe to call here.
  useExpoNotifications();

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
