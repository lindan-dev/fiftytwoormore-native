// Matches the real structure of src/pages/Index.tsx: there is no bottom
// tab bar in the web app. It's a single page (HomeScreen here) that
// internally toggles between Log/Stats/Admin content, with Profile
// reached via a header icon (pushed as a stack screen) rather than a tab.
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import { colors } from "../theme/colors";

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
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator({ onOnboardingComplete }: { onOnboardingComplete: () => void }) {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Home" component={HomeScreen} />
      <RootStack.Screen name="Profile" component={ProfileScreen} />
      <RootStack.Screen name="YearInReview" component={YearInReviewScreen} />
      <RootStack.Screen name="Onboarding">
        {() => <OnboardingScreen onComplete={onOnboardingComplete} />}
      </RootStack.Screen>
    </RootStack.Navigator>
  );
}

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasSeenOnboarding(!!seen);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasSeenOnboarding(!!seen);
      } else {
        setHasSeenOnboarding(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!session ? (
        <AuthNavigator />
      ) : !hasSeenOnboarding ? (
        <OnboardingScreen
          onComplete={async () => {
            await AsyncStorage.setItem(ONBOARDING_KEY, "1");
            setHasSeenOnboarding(true);
          }}
        />
      ) : (
        <AppNavigator onOnboardingComplete={() => {}} />
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
