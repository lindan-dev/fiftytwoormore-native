// Ported from src/components/OnThisDay.tsx. Same date-fns grouping logic
// and buildOnThisDayCopy() call as the web version - pure logic, unchanged.
import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Sparkles } from "lucide-react-native";
import { format, getMonth, getDate, getYear } from "date-fns";
import { buildOnThisDayCopy, type OnThisDayActivity } from "../lib/onThisDayCopy";
import { colors, radius, spacing } from "../theme/colors";

interface Activity {
  id: string;
  activity_date: string;
  emoji?: string | null;
  notes?: string | null;
}

interface OnThisDayProps {
  activities: Activity[];
  userId?: string;
}

export default function OnThisDay({ activities, userId = "anonymous" }: OnThisDayProps) {
  const memories = useMemo(() => {
    const today = new Date();
    const todayMonth = getMonth(today);
    const todayDate = getDate(today);
    const currentYear = getYear(today);

    const byYear = new Map<number, Activity[]>();

    activities.forEach((activity) => {
      const activityDate = new Date(activity.activity_date);
      const activityMonth = getMonth(activityDate);
      const activityDay = getDate(activityDate);
      const activityYear = getYear(activityDate);

      if (activityMonth === todayMonth && activityDay === todayDate && activityYear !== currentYear) {
        if (!byYear.has(activityYear)) byYear.set(activityYear, []);
        byYear.get(activityYear)!.push(activity);
      }
    });

    return Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, 2);
  }, [activities]);

  const memoryCopy = useMemo(() => {
    const today = new Date();
    const currentYear = getYear(today);
    const todayIso = format(today, "yyyy-MM-dd");

    return memories.map(([year, yearActivities]) => {
      const yearsBack = currentYear - year;
      const items: OnThisDayActivity[] = yearActivities.map((a) => ({
        id: a.id,
        activity_date: a.activity_date,
        emoji: a.emoji ?? undefined,
        notes: a.notes ?? undefined,
      }));

      const copy = buildOnThisDayCopy({ yearsBack, items, userId, date: todayIso });
      return { year, yearActivities, copy };
    });
  }, [memories, userId]);

  if (memories.length === 0) {
    return (
      <View style={styles.cardEmpty}>
        <View style={styles.headerRow}>
          <Sparkles size={16} color={colors.mutedForeground} />
          <Text style={styles.headerTitleMuted}>On this day</Text>
        </View>
        <Text style={styles.emptyText}>No memories here yet. Everything starts somewhere.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Sparkles size={16} color={colors.primary} />
        <Text style={styles.headerTitle}>On this day</Text>
      </View>

      <View style={styles.body}>
        {memoryCopy.map(({ year, yearActivities, copy }) => (
          <View key={year} style={styles.memoryBlock}>
            <View style={styles.yearRow}>
              <Text style={styles.yearText}>{year}</Text>
              <View style={styles.emojiRow}>
                {yearActivities.slice(0, 5).map((activity) => (
                  <Text key={activity.id} style={styles.emojiText}>
                    {activity.emoji || "✨"}
                  </Text>
                ))}
                {yearActivities.length > 5 && (
                  <Text style={styles.moreText}>+{yearActivities.length - 5}</Text>
                )}
              </View>
            </View>
            <Text style={styles.copyTitle}>{copy.title}</Text>
            {copy.subtitle && <Text style={styles.copySubtitle}>{copy.subtitle}</Text>}
            {copy.body && <Text style={styles.copyBody}>{copy.body}</Text>}
          </View>
        ))}
        {memoryCopy[0]?.copy.cta && <Text style={styles.cta}>{memoryCopy[0].copy.cta}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary + "1a",
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  cardEmpty: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.mutedForeground + "33",
    borderStyle: "dashed",
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  headerTitleMuted: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  emptyText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontStyle: "italic",
  },
  body: {
    gap: spacing.md,
  },
  memoryBlock: {
    gap: 2,
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  yearText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.mutedForeground,
    minWidth: 40,
  },
  emojiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  emojiText: {
    fontSize: 18,
  },
  moreText: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginLeft: 2,
  },
  copyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
  },
  copySubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontStyle: "italic",
  },
  copyBody: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  cta: {
    fontSize: 12,
    color: colors.primary,
    marginTop: spacing.xs,
  },
});
