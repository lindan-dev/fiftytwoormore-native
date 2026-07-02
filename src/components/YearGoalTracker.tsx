// Ported from the inline "Year Goal Tracker" block in src/pages/Index.tsx.
// Same tier/multiplier math (52, 104, 156...) and last-year marker logic.
import { View, Text, StyleSheet } from "react-native";
import { startOfYear, endOfYear, parseISO, differenceInWeeks, subYears } from "date-fns";
import { colors, radius, spacing } from "../theme/colors";

interface Activity {
  activity_date: string;
}

export default function YearGoalTracker({ activities }: { activities: Activity[] }) {
  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  const yearActivities = activities.filter((a) => {
    const d = parseISO(a.activity_date);
    return d >= yearStart && d <= yearEnd;
  });
  const yearCount = yearActivities.length;
  const weeksLeft = Math.max(0, differenceInWeeks(yearEnd, now));

  const lastYearStart = startOfYear(subYears(now, 1));
  const lastYearSamePoint = subYears(now, 1);
  const lastYearCount = activities.filter((a) => {
    const d = parseISO(a.activity_date);
    return d >= lastYearStart && d <= lastYearSamePoint;
  }).length;

  const currentGoal = Math.ceil(yearCount / 52) * 52 || 52;
  const previousGoal = currentGoal - 52;
  const progressInCurrentTier = yearCount - previousGoal;
  const progressPercentage = Math.min(100, (progressInCurrentTier / 52) * 100);
  const multiplier = Math.floor(yearCount / 52) + 1;
  const completedTiers = Math.floor(yearCount / 52);

  const lastYearInSameTier = Math.min(lastYearCount, 52);
  const lastYearPercentage = (lastYearInSameTier / 52) * 100;

  const diff = yearCount - lastYearCount;
  const isAhead = diff > 0;
  const isBehind = diff < 0;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.topText}>
          {yearCount}/{currentGoal} this year
        </Text>
        <View style={styles.badgeRow}>
          {Array.from({ length: completedTiers }).map((_, i) => (
            <View key={i} style={styles.badgeDone}>
              <Text style={styles.badgeDoneText}>x{i + 1}</Text>
            </View>
          ))}
          <View style={styles.badgeCurrent}>
            <Text style={styles.badgeCurrentText}>x{multiplier}</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
        {lastYearCount > 0 && (
          <View style={[styles.marker, { left: `${Math.min(98, Math.max(1, lastYearPercentage))}%` }]} />
        )}
      </View>

      {lastYearCount > 0 && (
        <Text style={[styles.compareText, isAhead && styles.ahead, isBehind && styles.behind]}>
          {isAhead ? `${diff} ahead of last year` : isBehind ? `${Math.abs(diff)} behind last year` : "Same pace as last year"}
        </Text>
      )}

      <Text style={styles.footerText}>
        {yearCount < 52
          ? `${52 - yearCount} more to reach your goal with ${weeksLeft} ${weeksLeft === 1 ? "week" : "weeks"} left!`
          : `Crushing it! ${yearCount - previousGoal} of 52 towards ${currentGoal} 🔥`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary + "0d",
    borderWidth: 2,
    borderColor: colors.primary + "33",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 4,
  },
  badgeDone: {
    backgroundColor: colors.primary + "4d",
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeDoneText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryForeground,
    textDecorationLine: "line-through",
  },
  badgeCurrent: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeCurrentText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primaryForeground,
  },
  progressTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.muted,
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  marker: {
    position: "absolute",
    top: 0,
    width: 2,
    height: 12,
    backgroundColor: colors.destructive + "99",
  },
  compareText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    color: colors.mutedForeground,
  },
  ahead: {
    color: "#16a34a",
  },
  behind: {
    color: colors.destructive,
  },
  footerText: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
