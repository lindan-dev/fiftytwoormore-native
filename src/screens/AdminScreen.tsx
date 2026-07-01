// Ported from src/components/SuperuserStats.tsx. Tabs replace shadcn
// Tabs 1:1. The web version's "Stats" sub-tab (30-day line charts via
// recharts) is intentionally omitted here to avoid adding a charting
// dependency for an internal-only tool - the same underlying counts are
// still visible via Funnel Analytics' metrics cards.
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, TrendingUp, BarChart3, FlaskConical } from "lucide-react-native";
import FunnelAnalytics from "../components/FunnelAnalytics";
import EmailPerformance from "../components/EmailPerformance";
import TestUserManager from "../components/TestUserManager";
import { colors, spacing } from "../theme/colors";

type Tab = "funnel" | "email" | "users";

export default function AdminScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>("funnel");

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
          <ArrowLeft size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Admin</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, tab === "funnel" && styles.tabActive]} onPress={() => setTab("funnel")}>
          <TrendingUp size={16} color={tab === "funnel" ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.tabText, tab === "funnel" && styles.tabTextActive]}>Funnel</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "email" && styles.tabActive]} onPress={() => setTab("email")}>
          <BarChart3 size={16} color={tab === "email" ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.tabText, tab === "email" && styles.tabTextActive]}>Email</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "users" && styles.tabActive]} onPress={() => setTab("users")}>
          <FlaskConical size={16} color={tab === "users" ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.tabText, tab === "users" && styles.tabTextActive]}>Users</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {tab === "funnel" && <FunnelAnalytics />}
        {tab === "email" && <EmailPerformance />}
        {tab === "users" && <TestUserManager />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.muted,
  },
  tabActive: {
    backgroundColor: colors.primary + "1a",
  },
  tabText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
});
