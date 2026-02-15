import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  let token: string | null = null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const existingStatus = await Notifications.getPermissionsAsync();
    let finalStatus: string | undefined = undefined;

    // Handle both old (string) and new (object with 'granted' property) API responses
    if (typeof existingStatus === "string") {
      finalStatus = existingStatus;
    } else if (existingStatus && typeof existingStatus === "object" && "granted" in existingStatus) {
      // New API: status is an object, check if 'granted' is truthy
      finalStatus = existingStatus.granted ? "granted" : "denied";
    }

    if (finalStatus !== "granted") {
      const permissions = await Notifications.requestPermissionsAsync();
      // Handle new API response
      if (typeof permissions === "string") {
        finalStatus = permissions;
      } else if (permissions && typeof permissions === "object" && "granted" in permissions) {
        finalStatus = permissions.granted ? "granted" : "denied";
      }
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!");
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    console.log("Must use physical device for Push Notifications");
  }

  return token;
}

export function setupNotificationHandlers() {
  // Handle notifications received while app is foregrounded
  Notifications.addNotificationReceivedListener((notification) => {
    console.log("Notification received:", notification);
  });

  // Handle notification taps
  Notifications.addNotificationResponseReceivedListener((response) => {
    console.log("Notification tapped:", response);
    // Navigate to appropriate screen based on notification data
    const data = response.notification.request.content.data;
    if (data?.type) {
      // Handle navigation based on notification type
      console.log("Navigate to:", data.type);
    }
  });
}
