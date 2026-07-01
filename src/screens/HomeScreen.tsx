// Ported from the activity-logging portion of src/pages/Index.tsx
// (fetchActivities, handleLogActivity, handleUpdateActivity,
// handleDeleteActivity). Partner-connection gating, invitations, and stats
// live in their own screens per the migration plan - this screen focuses
// on the core log/view flow.
import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Heart } from "lucide-react-native";
import { supabase } from "../integrations/supabase/client";
import { useAnalytics } from "../hooks/useAnalytics";
import EmojiSelector from "../components/EmojiSelector";
import LocationPicker, { LocationValue } from "../components/LocationPicker";
import ActivityLog from "../components/ActivityLog";
import { colors, radius, spacing } from "../theme/colors";

interface Activity {
  id: string;
  user_id: string;
  activity_date: string;
  created_at: string;
  emoji?: string | null;
  notes?: string | null;
  location_label?: string | null;
  location_country?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

export default function HomeScreen() {
  const { track } = useAnalytics();
  const [userId, setUserId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [hasPartner, setHasPartner] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [selectedNotes, setSelectedNotes] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationValue | null>(null);
  const [logging, setLogging] = useState(false);

  const fetchActivities = useCallback(async (uid: string) => {
    const { data: partnerId } = await supabase.rpc("get_partner_id", { user_id: uid });
    setHasPartner(!!partnerId);

    const userIds = partnerId ? [uid, partnerId] : [uid];
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .in("user_id", userIds)
      .order("activity_date", { ascending: false });

    if (error) {
      Alert.alert("Error", "Failed to load activities");
    } else {
      setActivities(data || []);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (uid) {
        setUserId(uid);
        fetchActivities(uid);
      }
    });
  }, [fetchActivities]);

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    await fetchActivities(userId);
    setRefreshing(false);
  };

  const handleLogActivity = async (
    activityDate?: Date,
    emoji?: string,
    notes?: string,
    location?: LocationValue | null,
  ) => {
    if (!userId) return;
    const dateToLog = activityDate || new Date();

    const { error } = await supabase.from("activities").insert([
      {
        user_id: userId,
        activity_date: dateToLog.toISOString(),
        emoji: emoji || null,
        notes: notes || null,
        location_label: location?.label || null,
        location_country: location?.country || null,
        location_lat: location?.lat ?? null,
        location_lng: location?.lng ?? null,
      },
    ]);

    if (error) {
      Alert.alert("Error", "Failed to log activity");
    } else {
      const isFirstActivity = activities.length === 0;
      track(isFirstActivity ? "first_activity_logged" : "activity_logged", {
        has_partner: hasPartner,
        emoji: emoji || "",
      });
      fetchActivities(userId);
      setDialogOpen(false);
      setSelectedEmoji("");
      setSelectedNotes("");
      setSelectedLocation(null);
    }
  };

  const handleQuickLog = () => {
    if (!selectedEmoji) {
      Alert.alert("Pick an emoji", "Choose an emoji before logging.");
      return;
    }
    setLogging(true);
    handleLogActivity(new Date(), selectedEmoji, selectedNotes, selectedLocation).finally(() =>
      setLogging(false),
    );
  };

  const handleUpdateActivity = async (
    id: string,
    activityDate: Date,
    emoji: string,
    notes?: string,
    location?: LocationValue | null,
  ) => {
    const { error } = await supabase
      .from("activities")
      .update({
        activity_date: activityDate.toISOString(),
        emoji,
        notes: notes || null,
        location_label: location?.label ?? null,
        location_country: location?.country ?? null,
        location_lat: location?.lat ?? null,
        location_lng: location?.lng ?? null,
      })
      .eq("id", id);

    if (error) {
      Alert.alert("Error", "Failed to update activity");
    } else if (userId) {
      fetchActivities(userId);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) {
      Alert.alert("Error", "Failed to delete activity");
    } else if (userId) {
      fetchActivities(userId);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Heart size={22} color={colors.primary} />
          <Text style={styles.headerTitle}>fiftytwoormore</Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => setDialogOpen(true)}>
          <Plus size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ActivityLog
          activities={activities}
          onDelete={handleDeleteActivity}
          onUpdate={handleUpdateActivity}
          currentUserId={userId ?? undefined}
        />
      </ScrollView>

      <Modal
        visible={dialogOpen}
        animationType="slide"
        onRequestClose={() => setDialogOpen(false)}
      >
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Log an activity</Text>

          <Text style={styles.fieldLabel}>Emoji</Text>
          <EmojiSelector selectedEmoji={selectedEmoji} onSelect={setSelectedEmoji} />

          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            value={selectedNotes}
            onChangeText={setSelectedNotes}
            placeholder="Add a note..."
            maxLength={200}
            style={styles.input}
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>Location (optional)</Text>
          <LocationPicker value={selectedLocation} onChange={setSelectedLocation} />

          <Pressable
            onPress={handleQuickLog}
            disabled={!selectedEmoji || logging}
            style={[styles.primaryButton, (!selectedEmoji || logging) && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>{logging ? "Logging..." : "Log now"}</Text>
          </Pressable>
          <Pressable onPress={() => setDialogOpen(false)} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </Modal>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.foreground,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  cancelButtonText: {
    color: colors.mutedForeground,
  },
});
