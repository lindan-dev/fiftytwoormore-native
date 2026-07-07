// Matches the real structure of src/pages/Index.tsx: there is no bottom
// tab bar in the web app. It's a single page (HomeScreen here) that
// internally toggles between Log/Stats/Admin content, with Profile
// reached via a header icon (pushed as a stack screen) rather than a tab.
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoLinking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import { colors } from "../theme/colors";
import { navigationRef } from "../lib/navigationRef";
import { PENDING_INVITE_CODE_KEY, extractInviteCode } from "../lib/storageKeys";

import AuthScreen from "../screens/AuthScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import YearInReviewScreen from "../screens/YearInReviewScreen";

const ONBOARDING_KEY = "fiftytwoormore:hasSeenOnboarding";

const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function AuthNavigator({ defaultToSignUp }: { defaultToSignUp: boolean }) {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Auth">
        {() => <AuthScreen defaultToSignUp={defaultToSignUp} />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

// Wraps OnboardingScreen when it's opened as a replay (via the header info
// icon) rather than as the first-run gate. In this context "complete"
// should just close the replay and return to Home, not touch the
// first-run AsyncStorage flag again.
function OnboardingReplayScreen() {
  const navigation = useNavigation();
  return <OnboardingScreen onComplete={() => navigation.goBack()} />;
}

function AppNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Home" component={HomeScreen} />
      <RootStack.Screen name="Profile" component={ProfileScreen} />
      <RootStack.Screen name="YearInReview" component={YearInReviewScreen} />
      <RootStack.Screen name="Onboarding" component={OnboardingReplayScreen} />
    </RootStack.Navigator>
  );
}

/**
 * Extracts Supabase auth tokens from an incoming deep link (used for both
 * password-recovery and email-confirmation links). Supabase appends
 * tokens as a URL fragment (`#access_token=...&refresh_token=...`), not a
 * query string - expo-linking's parse() only reads the query string, so
 * this fragment has to be parsed manually.
 */
function extractAuthTokens(url: string): { access_token: string; refresh_token: string } | null {
  const hashIndex = url.indexOf("#");
  const paramsString = hashIndex >= 0 ? url.slice(hashIndex + 1) : url.split("?")[1];
  if (!paramsString) return null;

  const params = new URLSearchParams(paramsString);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  const captureConnectLink = async (url: string) => {
    const { queryParams } = ExpoLinking.parse(url);
    const code = (typeof queryParams?.code === "string" ? queryParams.code : null) ?? extractInviteCode(url);
    if (code) {
      await AsyncStorage.setItem(PENDING_INVITE_CODE_KEY, code);
      setPendingInviteCode(code);
    }
  };

  // Startup sequence runs as one deliberate chain, not parallel effects:
  // check for a pending/incoming invite code FIRST and wait for it to
  // fully resolve, THEN check the session, THEN stop showing the loading
  // spinner. This matters because AuthScreen reads `defaultToSignUp` only
  // once via useState's initial value - if the session check finished
  // (and hid the loading screen) before the invite-code check landed,
  // AuthScreen would already be mounted with defaultToSignUp=false and
  // would never pick up the code arriving a moment later.
  useEffect(() => {
    (async () => {
      const storedCode = await AsyncStorage.getItem(PENDING_INVITE_CODE_KEY);
      if (storedCode) setPendingInviteCode(storedCode);

      const initialUrl = await ExpoLinking.getInitialURL();
      if (initialUrl?.includes("connect")) {
        await captureConnectLink(initialUrl);
      }

      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session) {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasSeenOnboarding(!!seen);
      }
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      }
      if (newSession) {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasSeenOnboarding(!!seen);
      } else {
        setHasSeenOnboarding(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Warm-start case: app already running, a new link arrives via event
  // rather than getInitialURL(). Handles reset-password, email-confirmed,
  // and connect links the same way as the startup chain above.
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;

      if (url.includes("connect")) {
        await captureConnectLink(url);
        return;
      }

      const isPasswordReset = url.includes("reset-password");
      const isEmailConfirmation = url.includes("email-confirmed");
      if (!isPasswordReset && !isEmailConfirmation) return;

      const tokens = extractAuthTokens(url);
      if (!tokens) return;

      const { error } = await supabase.auth.setSession(tokens);
      if (error) return;

      if (isPasswordReset) {
        setIsPasswordRecovery(true);
      } else {
        Alert.alert("Email confirmed! 🎉", "Time to invite your partner.");
      }
    };

    const subscription = ExpoLinking.addEventListener("url", (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {isPasswordRecovery ? (
        <ResetPasswordScreen onDone={() => setIsPasswordRecovery(false)} />
      ) : !session ? (
        <AuthNavigator defaultToSignUp={!!pendingInviteCode} />
      ) : !hasSeenOnboarding ? (
        <OnboardingScreen
          onComplete={async () => {
            await AsyncStorage.setItem(ONBOARDING_KEY, "1");
            setHasSeenOnboarding(true);
          }}
        />
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
