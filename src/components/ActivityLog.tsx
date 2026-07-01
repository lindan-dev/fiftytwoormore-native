// Ported from src/components/ActivityLog.tsx. Same profile-fetching logic
// and special-date badge logic as the web version. Differences forced by
// the platform:
//  - shadcn Dialog -> RN Modal
//  - HTML date/time inputs -> @react-native-community/datetimepicker
//  - Tailwind gradient/hover states -> flat colors (no hover on touch)
import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ScrollView, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Trash2, Pencil, MapPin } from "lucide-react-native";
import { supabase } from "../integrations/supabase/client";
import EmojiSelector from "./EmojiSelector";
import LocationPicker, { LocationValue } from "./LocationPicker";
import { countryFlag } from "../lib/countryFlag";
import { colors, radius, spacing } from "../theme/colors";

interface Activity {
  id: string;
  activity_date: string;
  user_id: string;
  emoji?: string | null;
  notes?: string | null;
  location_label?: string | null;
  location_country?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

interface Profile {
  user_id: string;
  name: string | null;
  birthday?: string | null;
}

interface ActivityLogProps {
  activities: Activity[];
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    activityDate: Date,
    emoji: string,
    notes?: string,
    location?: LocationValue | null,
  ) => void;
  currentUserId?: string;
}

export default function ActivityLog({ activities, onDelete, onUpdate, currentUserId }: ActivityLogProps) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editDateTime, setEditDateTime] = useState(new Date());
  const [editEmoji, setEditEmoji] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLocation, setEditLocation] = useState<LocationValue | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    const fetchProfiles = async () => {
      const userIds = [...new Set(activities.map((a) => a.user_id))];
      if (userIds.length === 0) return;

      if (currentUserId) {
        const { data: coupleData } = await supabase
          .from("couples")
          .select("user1_id, user2_id")
          .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
          .maybeSingle();

        if (coupleData) {
          const partnerId =
            coupleData.user1_id === currentUserId ? coupleData.user2_id : coupleData.user1_id;
          if (!userIds.includes(partnerId)) userIds.push(partnerId);
          if (!userIds.includes(currentUserId)) userIds.push(currentUserId);
        }
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, birthday")
        .in("user_id", userIds);

      if (data && !error) {
        const profileMap: Record<string, Profile> = {};
        data.forEach((profile: Profile) => {
          profileMap[profile.user_id] = profile;
        });
        setProfiles(profileMap);
      }
    };

    fetchProfiles();
  }, [activities, currentUserId]);

  const handleEditClick = (activity: Activity) => {
    setEditingActivity(activity);
    setEditDateTime(new Date(activity.activity_date));
    setEditEmoji(activity.emoji || "");
    setEditNotes(activity.notes || "");
    setEditLocation(
      activity.location_label
        ? {
            label: activity.location_label,
            country: activity.location_country ?? null,
            lat: activity.location_lat ?? null,
            lng: activity.location_lng ?? null,
          }
        : null,
    );
  };

  const closeEdit = () => {
    setEditingActivity(null);
    setEditEmoji("");
    setEditNotes("");
    setEditLocation(null);
  };

  const handleSaveEdit = () => {
    if (!editingActivity || !editEmoji) return;
    onUpdate(editingActivity.id, editDateTime, editEmoji, editNotes, editLocation);
    closeEdit();
  };

  const getSpecialDateBadge = (activityDate: string) => {
    const date = new Date(activityDate);
    const activityMonth = date.getMonth() + 1;
    const activityDay = date.getDate();

    for (const profile of Object.values(profiles)) {
      if (profile?.birthday) {
        const [, month, day] = profile.birthday.split("-").map(Number);
        if (month === activityMonth && day === activityDay) {
          return { label: "🎂 Birthday", color: "#ec4899" };
        }
      }
    }
    if (activityMonth === 12 && activityDay === 24) return { label: "🎄 Christmas", color: "#22c55e" };
    if (activityMonth === 12 && activityDay === 31) return { label: "🎉 New Year's", color: "#a855f7" };
    if (activityMonth === 2 && activityDay === 29) return { label: "🐸 Leap Day", color: "#3b82f6" };
    return null;
  };

  if (activities.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>No activities logged yet. Start tracking your moments together!</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {activities.map((activity) => {
        const isCurrentUser = currentUserId === activity.user_id;
        const profile = profiles[activity.user_id];
        const loggedBy = profile?.name || "Unknown";
        const specialDate = getSpecialDateBadge(activity.activity_date);
        const date = new Date(activity.activity_date);

        return (
          <View
            key={activity.id}
            style={[styles.card, specialDate ? styles.cardSpecial : styles.cardNormal]}
          >
            <View style={styles.cardMain}>
              {activity.emoji && <Text style={styles.emoji}>{activity.emoji}</Text>}
              <View style={styles.cardText}>
                <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
                <Text style={styles.metaText}>
                  {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {" (by "}
                  {isCurrentUser ? "you" : loggedBy}
                  {")"}
                </Text>
                {activity.notes && <Text style={styles.notesText}>{activity.notes}</Text>}
                {activity.location_label && (
                  <View style={styles.locationRow}>
                    <MapPin size={12} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>
                      {countryFlag(activity.location_country)} {activity.location_label}
                    </Text>
                  </View>
                )}
                {specialDate && (
                  <View style={[styles.badge, { borderColor: specialDate.color }]}>
                    <Text style={[styles.badgeText, { color: specialDate.color }]}>
                      {specialDate.label}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {isCurrentUser && (
              <View style={styles.actions}>
                <Pressable onPress={() => handleEditClick(activity)} style={styles.iconButton}>
                  <Pencil size={16} color={colors.foreground} />
                </Pressable>
                <Pressable onPress={() => onDelete(activity.id)} style={styles.iconButton}>
                  <Trash2 size={16} color={colors.destructive} />
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      <Modal visible={!!editingActivity} animationType="slide" onRequestClose={closeEdit}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Activity</Text>

          <Text style={styles.fieldLabel}>Date & time</Text>
          <View style={styles.dateTimeRow}>
            <Pressable style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateTimeText}>{editDateTime.toLocaleDateString()}</Text>
            </Pressable>
            <Pressable style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.dateTimeText}>
                {editDateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </Pressable>
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={editDateTime}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, selected) => {
                setShowDatePicker(false);
                if (selected) {
                  const merged = new Date(editDateTime);
                  merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                  setEditDateTime(merged);
                }
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={editDateTime}
              mode="time"
              onChange={(_, selected) => {
                setShowTimePicker(false);
                if (selected) {
                  const merged = new Date(editDateTime);
                  merged.setHours(selected.getHours(), selected.getMinutes());
                  setEditDateTime(merged);
                }
              }}
            />
          )}

          <Text style={styles.fieldLabel}>Emoji</Text>
          <EmojiSelector selectedEmoji={editEmoji} onSelect={setEditEmoji} />

          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            value={editNotes}
            onChangeText={setEditNotes}
            placeholder="Add a note..."
            maxLength={200}
            style={styles.input}
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>Location (optional)</Text>
          <LocationPicker value={editLocation} onChange={setEditLocation} />

          <Pressable
            onPress={handleSaveEdit}
            disabled={!editEmoji}
            style={[styles.primaryButton, !editEmoji && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>Save Changes</Text>
          </Pressable>
          <Pressable onPress={closeEdit} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  emptyCard: {
    padding: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary + "33",
    borderStyle: "dashed",
    alignItems: "center",
  },
  emptyText: {
    color: colors.mutedForeground,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    backgroundColor: colors.card,
  },
  cardNormal: {
    borderColor: colors.primary + "1a",
  },
  cardSpecial: {
    borderColor: colors.primary + "66",
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  emoji: {
    fontSize: 28,
  },
  cardText: {
    flex: 1,
  },
  dateText: {
    fontWeight: "600",
    fontSize: 15,
    color: colors.foreground,
  },
  metaText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  notesText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontStyle: "italic",
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  badge: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  iconButton: {
    padding: spacing.sm,
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
  dateTimeRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dateTimeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  dateTimeText: {
    color: colors.foreground,
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
