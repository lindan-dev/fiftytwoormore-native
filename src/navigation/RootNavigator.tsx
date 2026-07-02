// Matches the real structure of src/pages/Index.tsx: there is no bottom
// tab bar in the web app. It's a single page (HomeScreen here) that
// internally toggles between Log/Stats/Admin content, with Profile
// reached via a header icon (pushed as a stack screen) rather than a tab.
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoLinking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import { colors } from "../theme/colors";
import { navigationRef } from "../lib/navigationRef";

import AuthScreen from "../screens/AuthScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import YearInReviewScreen from "../screens/YearInReviewScreen";

const ONBOARDING_KEY = "fiftytwoormore:hasSeenOnboarding";

const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Auth" component={AuthScreen} />
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
 * Extracts Supabase auth tokens from an incoming reset-password deep link.
 * Supabase's recovery redirect appends tokens as a URL fragment
 * (`#access_token=...&refresh_token=...&type=recovery`), not a query
 * string - expo-linking's parse() only reads the query string, so this
 * fragment has to be parsed manually.
 */
function extractRecoveryTokens(url: string): { access_token: string; refresh_token: string } | null {
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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasSeenOnboarding(!!seen);
      }
      setLoading(false);
    });

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

  // Catches the "fiftytwoormore://reset-password#access_token=..." link
  // from the password reset email (both cold start and while running),
  // exchanges the tokens for a session, and switches into recovery mode
  // regardless of whatever screen the app happened to be showing.
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url || !url.includes("reset-password")) return;
      const tokens = extractRecoveryTokens(url);
      if (!tokens) return;

      const { error } = await supabase.auth.setSession(tokens);
      if (!error) setIsPasswordRecovery(true);
    };

    ExpoLinking.getInitialURL().then(handleUrl);
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
        <AuthNavigator />
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
