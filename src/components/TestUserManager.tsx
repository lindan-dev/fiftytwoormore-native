// Ported from src/components/TestUserManager.tsx. Same user_roles
// table logic as the web version.
import { useEffect, useState } from "react";
import { View, Text, Switch, ActivityIndicator, Alert, ScrollView, StyleSheet } from "react-native";
import { FlaskConical } from "lucide-react-native";
import { supabase } from "../integrations/supabase/client";
import { colors, radius, spacing } from "../theme/colors";

interface UserWithTestStatus {
  user_id: string;
  name: string | null;
  created_at: string;
  is_test_user: boolean;
}

export default function TestUserManager() {
  const [users, setUsers] = useState<UserWithTestStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: testRoles } = await supabase.from("user_roles").select("user_id").eq("role", "test_user");
      const testUserIds = new Set(testRoles?.map((r) => r.user_id) || []);

      setUsers(
        (profiles || []).map((p) => ({
          user_id: p.user_id,
          name: p.name,
          created_at: p.created_at,
          is_test_user: testUserIds.has(p.user_id),
        })),
      );
    } catch (error) {
      console.error("Error fetching users:", error);
      Alert.alert("Error", "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const toggleTestUser = async (userId: string, isCurrentlyTest: boolean) => {
    setUpdating(userId);
    try {
      if (isCurrentlyTest) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "test_user");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role: "test_user" }]);
        if (error) throw error;
      }
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, is_test_user: !isCurrentlyTest } : u)));
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update user");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  const testUserCount = users.filter((u) => u.is_test_user).length;
  const realUserCount = users.length - testUserCount;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <FlaskConical size={18} color={colors.foreground} />
          <Text style={styles.cardTitle}>Test User Management</Text>
        </View>
        <View style={styles.badgeRow}>
          <View style={styles.badgeOutline}>
            <Text style={styles.badgeOutlineText}>{realUserCount} real</Text>
          </View>
          <View style={styles.badgeSecondary}>
            <Text style={styles.badgeSecondaryText}>{testUserCount} test</Text>
          </View>
        </View>
      </View>
      <Text style={styles.description}>
        Test users are excluded from Funnel and Stats analytics, but still receive emails.
      </Text>

      <ScrollView style={styles.list} nestedScrollEnabled>
        {users.map((user) => (
          <View key={user.user_id} style={styles.userRow}>
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{user.name || "Unnamed User"}</Text>
                {user.is_test_user && (
                  <View style={styles.badgeSecondary}>
                    <Text style={styles.badgeSecondaryText}>Test</Text>
                  </View>
                )}
              </View>
              <Text style={styles.userMeta}>
                {user.user_id.substring(0, 8)}... • Joined {new Date(user.created_at).toLocaleDateString()}
              </Text>
            </View>
            {updating === user.user_id ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : (
              <Switch
                value={user.is_test_user}
                onValueChange={() => toggleTestUser(user.user_id, user.is_test_user)}
                trackColor={{ false: colors.muted, true: colors.primary }}
              />
            )}
          </View>
        ))}
        {users.length === 0 && <Text style={styles.mutedCenter}>No users found</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  badgeOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeOutlineText: {
    fontSize: 11,
    color: colors.foreground,
  },
  badgeSecondary: {
    backgroundColor: colors.muted,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeSecondaryText: {
    fontSize: 11,
    color: colors.foreground,
  },
  description: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  list: {
    maxHeight: 400,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  userInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  userName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  userMeta: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  mutedCenter: {
    textAlign: "center",
    color: colors.mutedForeground,
    paddingVertical: spacing.md,
  },
});
