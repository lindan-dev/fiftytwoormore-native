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
import { navigationRef } from "./navigationRef";

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

export async function registerForPushNotificationsAsync(): Promise<string | null> {
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

    // Registering goes through an edge function rather than a direct
    // client-side upsert: a push token belongs to a device, and if this
    // device was previously registered to a different account (e.g.
    // switching test accounts on the same simulator, or a phone changing
    // hands), reassigning it requires deleting a row this user doesn't
    // own - something RLS correctly blocks from the client, but which a
    // service-role edge function can do safely.
    const { error } = await supabase.functions.invoke("register-push-token", {
      body: { token, device_type: Platform.OS },
    });

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

/**
 * Navigates to the right screen when the user taps a notification,
 * based on the `data` payload set when the push was sent (see the
 * `send-*-push` edge functions). Call once, e.g. from App.tsx.
 */
export function addNotificationTapListener() {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | { screen?: string; year?: number; action?: string }
      | undefined;

    if (!data?.screen || !navigationRef.isReady()) return;

    if (data.screen === "YearInReview") {
      navigationRef.navigate("YearInReview", { year: data.year });
    } else if (data.screen === "Home") {
      navigationRef.navigate("Home", { action: data.action });
    }
  });
}
