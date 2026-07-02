// Ported from src/pages/Profile.tsx. Same Supabase logic for
// profile/partner fetching, save, disconnect, delete-account, benchmark
// opt-in, and the realtime couple-disconnection subscription.
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, User, Heart, Trash2, UserX, Users } from "lucide-react-native";
import { supabase } from "../integrations/supabase/client";
import { colors, radius, spacing } from "../theme/colors";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  birthday?: string;
}

interface Partner {
  id: string;
  name: string;
  birthday?: string;
}

interface Couple {
  id: string;
  anniversary?: string;
}

function toDateInputValue(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const [session, setSession] = useState<Session | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [benchmarkOptIn, setBenchmarkOptIn] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [showAnniversaryPicker, setShowAnniversaryPicker] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
    if (!error && data) {
      setName(data.name || "");
      setBirthday(data.birthday || "");
      setBenchmarkOptIn(data.benchmark_opt_in || false);
    }
  };

  const fetchPartner = async (userId: string) => {
    const { data: coupleData } = await supabase
      .from("couples")
      .select("*")
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .maybeSingle();

    if (coupleData) {
      const partnerId = coupleData.user1_id === userId ? coupleData.user2_id : coupleData.user1_id;
      setCouple({ id: coupleData.id, anniversary: coupleData.anniversary || undefined });
      setAnniversary(coupleData.anniversary || "");

      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", partnerId)
        .maybeSingle();

      if (partnerProfile) {
        setPartner({ id: partnerId, name: partnerProfile.name || "Partner", birthday: partnerProfile.birthday || undefined });
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchPartner(session.user.id);
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "superuser")
          .maybeSingle()
          .then(({ data }) => setIsSuperuser(!!data));
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !partner) return;

    const channel = supabase
      .channel("couple-disconnection")
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "couples" }, async (payload) => {
        const deletedCouple = payload.old as { user1_id: string; user2_id: string };
        if (deletedCouple.user1_id === session.user.id || deletedCouple.user2_id === session.user.id) {
          const partnerId = deletedCouple.user1_id === session.user.id ? deletedCouple.user2_id : deletedCouple.user1_id;
          const { data: partnerProfile } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", partnerId)
            .maybeSingle();
          const disconnectedPartnerName = partnerProfile?.name || "Your partner";
          Alert.alert(
            "Partner Disconnected",
            `${disconnectedPartnerName} has disconnected from you and all your data is gone. Better luck next time.`,
          );
          setPartner(null);
          navigation.goBack();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, partner]);

  const handleSave = async () => {
    if (!session?.user || !name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }
    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ name: name.trim(), birthday: birthday || null })
        .eq("user_id", session.user.id);
      if (profileError) throw profileError;

      if (couple) {
        const { error: coupleError } = await supabase
          .from("couples")
          .update({ anniversary: anniversary || null })
          .eq("id", couple.id);
        if (coupleError) throw coupleError;
      }

      Alert.alert("Success", "Profile updated successfully");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const performDisconnect = async () => {
    if (!session?.user) return;
    setDisconnecting(true);
    try {
      const { data: coupleData } = await supabase
        .from("couples")
        .select("*")
        .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
        .maybeSingle();

      if (coupleData) {
        const partnerId = coupleData.user1_id === session.user.id ? coupleData.user2_id : coupleData.user1_id;
        await supabase.from("activities").delete().in("user_id", [session.user.id, partnerId]);
        await supabase
          .from("couple_invitations")
          .delete()
          .or(`sender_id.eq.${session.user.id},sender_id.eq.${partnerId}`);
      }

      const { error: coupleError } = await supabase
        .from("couples")
        .delete()
        .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`);
      if (coupleError) throw coupleError;

      Alert.alert("Disconnected", "You have been disconnected and all shared data has been deleted");
      setPartner(null);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Are you sure?",
      "This will disconnect you from your partner. You'll need a new invitation code to reconnect. All shared activity history will remain but you won't be able to add new activities until you connect again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: performDisconnect },
      ],
    );
  };

  const performDeleteAccount = async () => {
    if (!session?.user) return;
    setDeleting(true);
    try {
      // Deletes all app data (activities, couple, invitations, profile)
      // AND the actual auth account (email+password) - see
      // BACKLOG.md/delete-account edge function. The old client-side-only
      // version left the login credential intact, so "permanently
      // deleted" wasn't accurate and re-logging in would hit a missing
      // profile row.
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;

      Alert.alert("Account Deleted", "All your data has been permanently deleted");
      await supabase.auth.signOut();
    } catch (error: any) {
      Alert.alert("Error", error.message);
      setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Your Account?",
      "This action cannot be undone. This will permanently delete your account and remove all your data from our servers, including your profile, activity history, partner connection, and all invitations.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete Everything", style: "destructive", onPress: performDeleteAccount },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Heart size={48} color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Your profile */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.avatar}>
              <User size={18} color="#fff" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Your Profile</Text>
              <Text style={styles.cardSubtitle}>Update your personal information</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Your name" style={styles.input} placeholderTextColor={colors.mutedForeground} />

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput value={session?.user.email ?? ""} editable={false} style={[styles.input, styles.inputDisabled]} />

          <Text style={styles.fieldLabel}>🎂 Birthday</Text>
          <Pressable style={styles.input} onPress={() => setShowBirthdayPicker(true)}>
            <Text style={styles.dateText}>{birthday || "Select date"}</Text>
          </Pressable>
          {showBirthdayPicker && (
            <DateTimePicker
              value={birthday ? new Date(birthday) : new Date()}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, selected) => {
                setShowBirthdayPicker(false);
                if (selected) setBirthday(toDateInputValue(selected));
              }}
            />
          )}

          {partner && (
            <>
              <Text style={styles.fieldLabel}>🫶 Anniversary</Text>
              <Pressable style={styles.input} onPress={() => setShowAnniversaryPicker(true)}>
                <Text style={styles.dateText}>{anniversary || "Select date"}</Text>
              </Pressable>
              {showAnniversaryPicker && (
                <DateTimePicker
                  value={anniversary ? new Date(anniversary) : new Date()}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(_, selected) => {
                    setShowAnniversaryPicker(false);
                    if (selected) setAnniversary(toDateInputValue(selected));
                  }}
                />
              )}
            </>
          )}

          <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryButtonText}>Save Changes</Text>}
          </Pressable>
        </View>

        {/* Partner */}
        {partner && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.avatar}>
                <Heart size={18} color="#fff" fill="#fff" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Connected Partner</Text>
                <Text style={styles.cardSubtitle}>{partner.name}</Text>
              </View>
            </View>

            {partner.birthday && (
              <View style={styles.mutedBox}>
                <Text style={styles.fieldLabel}>🎂 Partner's Birthday</Text>
                <Text style={styles.dateText}>
                  {new Date(partner.birthday + "T00:00:00").toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </View>
            )}

            <Pressable style={styles.destructiveButton} onPress={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Trash2 size={16} color="#fff" />
                  <Text style={styles.destructiveButtonText}>Disconnect from Partner</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Benchmarks */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.avatar}>
              <Users size={18} color="#fff" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Benchmarks</Text>
              <Text style={styles.cardSubtitle}>Compare with other couples anonymously</Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.fieldLabel}>Compare with other couples</Text>
              <Text style={styles.captionText}>See how your activity compares to similar couples. All data is anonymized.</Text>
            </View>
            <Switch
              value={benchmarkOptIn}
              onValueChange={async (checked) => {
                setBenchmarkOptIn(checked);
                if (session?.user?.id) {
                  const { error } = await supabase
                    .from("profiles")
                    .update({ benchmark_opt_in: checked })
                    .eq("user_id", session.user.id);
                  if (error) {
                    setBenchmarkOptIn(!checked);
                    Alert.alert("Error", "Failed to update benchmark settings");
                  }
                }
              }}
              trackColor={{ false: colors.muted, true: colors.primary }}
            />
          </View>
        </View>

        {/* Delete account */}
        <View style={[styles.card, styles.destructiveCard]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.avatar, styles.avatarDestructive]}>
              <UserX size={18} color="#fff" />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Delete Account</Text>
              <Text style={styles.cardSubtitle}>Permanently delete your account and all data</Text>
            </View>
          </View>

          <Pressable style={styles.destructiveButton} onPress={handleDeleteAccount} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <UserX size={16} color="#fff" />
                <Text style={styles.destructiveButtonText}>Forget Me</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
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
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary + "33",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  destructiveCard: {
    borderColor: colors.destructive + "33",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarDestructive: {
    backgroundColor: colors.destructive,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontWeight: "600",
    fontSize: 15,
    color: colors.foreground,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.foreground,
  },
  inputDisabled: {
    backgroundColor: colors.muted,
  },
  dateText: {
    color: colors.foreground,
  },
  mutedBox: {
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  destructiveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.destructive,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
  },
  destructiveButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  switchText: {
    flex: 1,
    marginRight: spacing.md,
  },
  captionText: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  adminButton: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  adminButtonText: {
    color: colors.foreground,
    fontWeight: "600",
  },
});
