// Wires CalendarView up with the same activity-fetching pattern as
// HomeScreen (see fetchActivities in src/pages/Index.tsx on the web side).
import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../integrations/supabase/client";
import CalendarView from "../components/CalendarView";
import { LocationValue } from "../components/LocationPicker";
import { colors, spacing } from "../theme/colors";

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

export default function CalendarScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);

  const fetchActivities = useCallback(async (uid: string) => {
    const { data: partnerId } = await supabase.rpc("get_partner_id", { user_id: uid });
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

  const handleUpdate = async (
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

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) {
      Alert.alert("Error", "Failed to delete activity");
    } else if (userId) {
      fetchActivities(userId);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <CalendarView
          activities={activities}
          currentUserId={userId ?? undefined}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
});
