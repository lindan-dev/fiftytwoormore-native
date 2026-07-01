import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

import AuthScreen from "../screens/AuthScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import HomeScreen from "../screens/HomeScreen";
import CalendarScreen from "../screens/CalendarScreen";
import StatsScreen from "../screens/StatsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import InvitationScreen from "../screens/InvitationScreen";
import YearInReviewScreen from "../screens/YearInReviewScreen";

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

// Onboarding/Invitation/YearInReview are pushed on top of the main tabs as
// full-screen modals/stack entries rather than being tabs themselves.
function AppNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabNavigator} />
      <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
      <RootStack.Screen name="Invitation" component={InvitationScreen} />
      <RootStack.Screen name="YearInReview" component={YearInReviewScreen} />
    </RootStack.Navigator>
  );
}

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
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
      {session ? <AppNavigator /> : <AuthNavigator />}
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
