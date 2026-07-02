// Ported from src/components/CalendarView.tsx. Same date-fns logic for
// month grid, special-event detection (birthdays/anniversary), and
// activity grouping as the web version. Differences forced by the platform:
//  - CSS grid-cols-7 -> flexbox with 7 equal-width cells
//  - shadcn Dialog -> RN Modal
//  - HTML date/time inputs -> @react-native-community/datetimepicker
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ChevronLeft, ChevronRight, Pencil, Trash2, MapPin } from "lucide-react-native";
import EmojiSelector from "./EmojiSelector";
import LocationPicker, { LocationValue } from "./LocationPicker";
import OnThisDay from "./OnThisDay";
import { countryFlag } from "../lib/countryFlag";
import { supabase } from "../integrations/supabase/client";
import { colors, radius, spacing } from "../theme/colors";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";

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

interface CalendarViewProps {
  activities: Activity[];
  currentUserId?: string;
  onDelete: (id: string) => void;
  onUpdate: (
    id: string,
    activityDate: Date,
    emoji: string,
    notes?: string,
    location?: LocationValue | null,
  ) => void;
}

const CELL_SIZE = Math.floor((Dimensions.get("window").width - spacing.lg * 2 - spacing.xs * 6) / 7);

export default function CalendarView({ activities, currentUserId, onDelete, onUpdate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedActivities, setSelectedActivities] = useState<Activity[]>([]);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editDateTime, setEditDateTime] = useState(new Date());
  const [editEmoji, setEditEmoji] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLocation, setEditLocation] = useState<LocationValue | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [anniversary, setAnniversary] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      const userIds = [...new Set(activities.map((a) => a.user_id))];
      if (userIds.length === 0) return;
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
  }, [activities]);

  useEffect(() => {
    const fetchAnniversary = async () => {
      if (!currentUserId) return;
      const { data } = await supabase
        .from("couples")
        .select("anniversary")
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .maybeSingle();
      if (data?.anniversary) setAnniversary(data.anniversary);
    };
    fetchAnniversary();
  }, [currentUserId]);

  const activitiesByDate = useMemo(() => {
    const grouped: Record<string, Activity[]> = {};
    activities.forEach((activity) => {
      const dateKey = format(new Date(activity.activity_date), "yyyy-MM-dd");
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(activity);
    });
    return grouped;
  }, [activities]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const startWeek = startOfWeek(start, { weekStartsOn: 1 });
    const endWeek = endOfWeek(end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startWeek, end: endWeek });
  }, [currentMonth]);

  const getDayActivities = (day: Date) => activitiesByDate[format(day, "yyyy-MM-dd")] || [];

  const getSpecialEvent = (day: Date) => {
    const monthDay = format(day, "MM-dd");
    let isBirthday = false;
    let isAnniversary = false;
    let birthdayName = "";

    for (const profile of Object.values(profiles)) {
      if (profile.birthday) {
        const birthdayMonthDay = format(new Date(profile.birthday), "MM-dd");
        if (birthdayMonthDay === monthDay) {
          isBirthday = true;
          birthdayName = profile.user_id === currentUserId ? "you" : profile.name || "";
        }
      }
    }

    if (anniversary) {
      const anniversaryMonthDay = format(new Date(anniversary), "MM-dd");
      if (anniversaryMonthDay === monthDay) isAnniversary = true;
    }

    let message = "";
    if (isBirthday && isAnniversary) message = `🎂 Happy birthday ${birthdayName}! 🫶 Happy anniversary`;
    else if (isBirthday) message = `🎂 Happy birthday ${birthdayName}!`;
    else if (isAnniversary) message = "🫶 Happy anniversary";

    return { isBirthday, isAnniversary, birthdayName, message };
  };

  const monthHighlights = useMemo(() => {
    const highlights: Array<{ date: Date; type: "birthday" | "anniversary"; name?: string }> = [];
    calendarDays.forEach((day) => {
      if (isSameMonth(day, currentMonth)) {
        const special = getSpecialEvent(day);
        if (special.isBirthday) highlights.push({ date: day, type: "birthday", name: special.birthdayName });
        if (special.isAnniversary) highlights.push({ date: day, type: "anniversary" });
      }
    });
    return highlights;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarDays, currentMonth, profiles, anniversary]);

  const handleDayPress = (day: Date) => {
    if (!isSameMonth(day, currentMonth)) return;
    const dayActivities = getDayActivities(day);
    const special = getSpecialEvent(day);
    if (dayActivities.length > 0 || special.isBirthday || special.isAnniversary) {
      setSelectedDay(day);
      setSelectedActivities(dayActivities);
    }
  };

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

  const handleSaveEdit = () => {
    if (!editingActivity || !editEmoji) return;
    onUpdate(editingActivity.id, editDateTime, editEmoji, editNotes, editLocation);
    setEditingActivity(null);
    setEditEmoji("");
    setEditNotes("");
    setEditLocation(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete this activity?",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete(id);
            setSelectedActivities((prev) => prev.filter((a) => a.id !== id));
            if (selectedActivities.length <= 1) setSelectedDay(null);
          },
        },
      ],
    );
  };

  const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Month navigation */}
        <View style={styles.monthNav}>
          <Pressable onPress={() => setCurrentMonth((prev) => subMonths(prev, 1))} style={styles.navButton}>
            <ChevronLeft size={18} color={colors.foreground} />
          </Pressable>
          <Text style={styles.monthLabel}>{format(currentMonth, "MMMM yyyy")}</Text>
          <Pressable onPress={() => setCurrentMonth((prev) => addMonths(prev, 1))} style={styles.navButton}>
            <ChevronRight size={18} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Highlights */}
        {monthHighlights.length > 0 && (
          <View style={styles.highlightsBox}>
            <Text style={styles.highlightsLabel}>This month:</Text>
            <View style={styles.highlightsRow}>
              {monthHighlights.map((highlight, idx) => (
                <Pressable
                  key={idx}
                  style={styles.highlightChip}
                  onPress={() => {
                    setCurrentMonth(highlight.date);
                    handleDayPress(highlight.date);
                  }}
                >
                  <Text style={styles.highlightChipText}>
                    {highlight.type === "birthday" ? "🎂" : "💍"}{" "}
                    {highlight.type === "birthday"
                      ? `Birthday ${highlight.name ? `(${highlight.name})` : ""} on ${format(highlight.date, "MMM d")}`
                      : `Anniversary on ${format(highlight.date, "MMM d")}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Weekday headers */}
        <View style={styles.weekRow}>
          {weekdayLabels.map((label, i) => (
            <View key={i} style={[styles.cell, { width: CELL_SIZE }]}>
              <Text style={styles.weekdayLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Day grid */}
        <View style={styles.grid}>
          {calendarDays.map((day, index) => {
            const dayActivities = getDayActivities(day);
            const hasActivities = dayActivities.length > 0;
            const activityCount = dayActivities.length;
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);
            const lastEmoji = hasActivities ? dayActivities[dayActivities.length - 1].emoji : null;
            const specialEvent = getSpecialEvent(day);
            const isClickable = hasActivities || specialEvent.isBirthday || specialEvent.isAnniversary;

            return (
              <Pressable
                key={index}
                onPress={() => handleDayPress(day)}
                disabled={!isCurrentMonth || !isClickable}
                style={[
                  styles.dayCell,
                  { width: CELL_SIZE, height: CELL_SIZE },
                  !isCurrentMonth && styles.dayCellFaded,
                  isCurrentDay && styles.dayCellToday,
                ]}
              >
                {specialEvent.isAnniversary && <View style={styles.anniversaryRing} />}
                {specialEvent.isBirthday && (
                  <View style={[styles.birthdayRing, specialEvent.isAnniversary && styles.birthdayRingInset]} />
                )}

                {lastEmoji ? (
                  <View style={styles.dayEmojiWrap}>
                    <Text style={styles.dayEmoji}>{lastEmoji}</Text>
                    {activityCount > 1 && (
                      <View style={styles.dotsRow}>
                        {Array.from({ length: Math.min(activityCount, 5) }).map((_, i) => (
                          <View key={i} style={styles.dot} />
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={[styles.dayNumber, !isCurrentMonth && styles.dayNumberFaded]}>
                    {format(day, "d")}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <OnThisDay activities={activities} userId={currentUserId} />

      {/* Day details modal */}
      <Modal
        visible={selectedDay !== null && !editingActivity}
        animationType="slide"
        onRequestClose={() => setSelectedDay(null)}
      >
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>{selectedDay && format(selectedDay, "MMMM d, yyyy")}</Text>

          {selectedDay &&
            (getSpecialEvent(selectedDay).isBirthday || getSpecialEvent(selectedDay).isAnniversary) && (
              <View style={styles.specialBanner}>
                <Text style={styles.specialBannerText}>{getSpecialEvent(selectedDay).message}</Text>
              </View>
            )}

          {selectedActivities.map((activity) => {
            const isCurrentUser = currentUserId === activity.user_id;
            const profile = profiles[activity.user_id];
            const loggedBy = profile?.name || "Unknown";
            return (
              <View key={activity.id} style={styles.activityCard}>
                {activity.emoji && <Text style={styles.activityEmoji}>{activity.emoji}</Text>}
                <View style={styles.activityInfo}>
                  <Text style={styles.activityMeta}>
                    {new Date(activity.activity_date).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" (by "}
                    {isCurrentUser ? "you" : loggedBy}
                    {")"}
                  </Text>
                  {activity.notes && <Text style={styles.activityNotes}>{activity.notes}</Text>}
                  {activity.location_label && (
                    <View style={styles.locationRow}>
                      <MapPin size={12} color={colors.mutedForeground} />
                      <Text style={styles.activityMeta}>
                        {countryFlag(activity.location_country)} {activity.location_label}
                      </Text>
                    </View>
                  )}
                </View>
                {isCurrentUser && (
                  <View style={styles.activityActions}>
                    <Pressable onPress={() => handleEditClick(activity)} style={styles.iconButton}>
                      <Pencil size={16} color={colors.foreground} />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(activity.id)} style={styles.iconButton}>
                      <Trash2 size={16} color={colors.destructive} />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}

          <Pressable onPress={() => setSelectedDay(null)} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Close</Text>
          </Pressable>
        </ScrollView>
      </Modal>

      {/* Edit modal */}
      <Modal visible={!!editingActivity} animationType="slide" onRequestClose={() => setEditingActivity(null)}>
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
          <Pressable onPress={() => setEditingActivity(null)} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  navButton: {
    padding: spacing.sm,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  highlightsBox: {
    backgroundColor: colors.primary + "0d",
    borderColor: colors.primary + "33",
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  highlightsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  highlightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  highlightChip: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  highlightChipText: {
    fontSize: 12,
    color: colors.foreground,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  cell: {
    alignItems: "center",
  },
  weekdayLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  dayCell: {
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellFaded: {
    opacity: 0.3,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  anniversaryRing: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#FF6B6B66",
  },
  birthdayRing: {
    position: "absolute",
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D9C6F080",
  },
  birthdayRingInset: {
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
  },
  dayEmojiWrap: {
    alignItems: "center",
    gap: 2,
  },
  dayEmoji: {
    fontSize: 18,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 2,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FF6B6B80",
  },
  dayNumber: {
    fontSize: 14,
    color: colors.foreground,
  },
  dayNumberFaded: {
    color: colors.mutedForeground,
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
  specialBanner: {
    backgroundColor: colors.primary + "0d",
    borderWidth: 2,
    borderColor: colors.primary + "80",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  specialBannerText: {
    fontWeight: "600",
    color: colors.primary,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  activityEmoji: {
    fontSize: 28,
  },
  activityInfo: {
    flex: 1,
  },
  activityMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  activityNotes: {
    fontSize: 13,
    color: colors.foreground,
    fontStyle: "italic",
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  activityActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  iconButton: {
    padding: spacing.sm,
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
