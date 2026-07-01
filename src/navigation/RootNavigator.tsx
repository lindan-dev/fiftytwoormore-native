import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import { colors } from "../theme/colors";

import AuthScreen from "../screens/AuthScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import HomeScreen from "../screens/HomeScreen";
import CalendarScreen from "../screens/CalendarScreen";
import StatsScreen from "../screens/StatsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import InvitationScreen from "../screens/InvitationScreen";
import YearInReviewScreen from "../screens/YearInReviewScreen";

const ONBOARDING_KEY = "fiftytwoormore:hasSeenOnboarding";

const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();
const MainTabs = createBottomTabNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Auth" component={AuthScreen} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabNavigator() {
  return (
    <MainTabs.Navigator screenOptions={{ headerShown: false }}>
      <MainTabs.Screen name="Home" component={HomeScreen} />
      <MainTabs.Screen name="Calendar" component={CalendarScreen} />
      <MainTabs.Screen name="Stats" component={StatsScreen} />
      <MainTabs.Screen name="Profile" component={ProfileScreen} />
    </MainTabs.Navigator>
  );
}

function AppNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
      <RootStack.Screen name="YearInReview" component={YearInReviewScreen} />
    </RootStack.Navigator>
  );
}

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [hasPartner, setHasPartner] = useState<boolean | null>(null);

  const checkPartner = async (uid: string) => {
    const { data } = await supabase
      .from("couples")
      .select("id")
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .maybeSingle();
    setHasPartner(!!data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasSeenOnboarding(!!seen);
        await checkPartner(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setHasSeenOnboarding(!!seen);
        await checkPartner(newSession.user.id);
      } else {
        setHasSeenOnboarding(null);
        setHasPartner(null);
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
      ) : hasPartner === false ? (
        <InvitationScreen
          userEmail={session.user.email ?? ""}
          userId={session.user.id}
          onConnected={() => setHasPartner(true)}
        />
      ) : hasPartner === null ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
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
