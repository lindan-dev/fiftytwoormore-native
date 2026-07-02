// Push notification setup: permission request, Expo push token retrieval,
// and registering that token against the current user in Supabase
// (push_tokens table). This only covers the client-side registration half
// of the notifications feature - actually sending notifications happens
// server-side via the `send-push-notification` edge function.
//
// IMPORTANT: this cannot be tested in Expo Go or a plain simulator run.
// Since Expo SDK 53, Expo Go no longer supports remote push notifications
// at all. Testing requires a development build (`eas build --profile
// development`) or a TestFlight build.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "../integrations/supabase/client";

// Foreground behavior: show an alert + play sound even while the app is
// open, matching how the web app's toasts behave for in-app feedback.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error("Missing EAS projectId - cannot fetch push token");
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;

    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        { user_id: userId, token, device_type: Platform.OS },
        { onConflict: "token" },
      );

    if (error) {
      console.error("Error saving push token:", error);
      return null;
    }

    return token;
  } catch (error) {
    // Expected to fail in Expo Go and plain simulator runs - that's fine,
    // this just means push isn't available in the current environment.
    console.log("Push notification registration skipped:", error);
    return null;
  }
}

export async function unregisterPushToken(token: string): Promise<void> {
  await supabase.from("push_tokens").delete().eq("token", token);
}
