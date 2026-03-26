import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { useAuthStore } from "@/store/auth";
import { api } from "@/services/api";

/**
 * useExpoNotifications
 *
 * Registers an Expo push token with the auth service once the user is
 * authenticated, and sets up a foreground notification listener for the
 * duration of the session.
 *
 * Registration flow:
 *   1. Wait for userId (user.id) to be available — never runs pre-auth.
 *   2. Request notification permissions if not already granted.
 *   3. Obtain the Expo push token via getExpoPushTokenAsync().
 *   4. POST { expo_push_token, platform } to /auth/push-tokens.
 *
 * The foreground listener is cleaned up on unmount.
 *
 * Sprint 42 TODO: navigate based on notification.request.content.data.type.
 */
export function useExpoNotifications() {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    // Critical: do not register until auth is resolved and user is known.
    if (!user?.id) return;

    let isMounted = true;

    async function registerToken() {
      // Push notifications only work on physical devices.
      if (!Device.isDevice) {
        console.log("[useExpoNotifications] Skipping — not a physical device");
        return;
      }

      // On Android, ensure the default notification channel exists.
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      // Check current permission status. Use the same defensive pattern as
      // services/notifications.ts to handle varying API shapes across SDK versions.
      const existingStatus = await Notifications.getPermissionsAsync();
      let isGranted = false;

      if (typeof existingStatus === "string") {
        isGranted = existingStatus === "granted";
      } else if (existingStatus && typeof existingStatus === "object") {
        // PermissionResponse shape: { granted: boolean, status: PermissionStatus }
        if ("granted" in existingStatus) {
          isGranted = Boolean(existingStatus.granted);
        } else if ("status" in existingStatus) {
          isGranted = (existingStatus as { status: string }).status === "granted";
        }
      }

      if (!isGranted) {
        const requestStatus = await Notifications.requestPermissionsAsync();
        if (typeof requestStatus === "string") {
          isGranted = requestStatus === "granted";
        } else if (requestStatus && typeof requestStatus === "object") {
          if ("granted" in requestStatus) {
            isGranted = Boolean(requestStatus.granted);
          } else if ("status" in requestStatus) {
            isGranted = (requestStatus as { status: string }).status === "granted";
          }
        }
      }

      if (!isGranted) {
        console.log(
          "[useExpoNotifications] Push notification permission not granted",
        );
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      const platform = Platform.OS === "ios" ? "ios" : "android";

      if (!isMounted) return;

      await api.registerPushToken(token, platform);
      console.log("[useExpoNotifications] Push token registered:", token);
    }

    registerToken().catch((err) => {
      console.error("[useExpoNotifications] Registration error:", err);
    });

    // Listen for notifications while the app is foregrounded.
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log(
          "[useExpoNotifications] Notification received:",
          notification,
        );
        // TODO Sprint 42: navigate based on notification.request.content.data.type
      },
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [user?.id]);
}
