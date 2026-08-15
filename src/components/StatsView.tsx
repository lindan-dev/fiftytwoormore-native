// Ported from src/components/StatsView.tsx. All calculation logic
// (streaks, best periods, consistency score, streak health, time-of-day,
// bunny days, cohort benchmarks) is identical to the web version - only
// the rendering layer changed (Card/Badge/Progress -> View/StyleSheet).
import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Calendar,
  Rabbit,
  Moon,
  Sunrise,
  Coffee,
  Sun,
  Sunset,
  Stars,
  Shield,
  AlertTriangle,
  CheckCircle,
  Users,
  ArrowUp,
  ArrowDown,
  Sparkles,
  LucideIcon,
} from "lucide-react-native";
import PeriodPicker from "./PeriodPicker";
import { usePeriodStats } from "../hooks/usePeriodStats";
import { comparisonLabels } from "./PeriodPicker";
import { colors, radius, spacing } from "../theme/colors";
import {
  startOfWeek,
  startOfMonth,
  startOfYear,
  subWeeks,
  subMonths,
  subYears,
  isWithinInterval,
  differenceInDays,
  format,
  endOfWeek,
  getDay,
} from "date-fns";

interface Activity {
  id: string;
  activity_date: string;
}

interface BenchmarkCohort {
  cohort_key: string;
  median_monthly_count: number | null;
  median_rolling_4_weeks: number | null;
  median_consistency_score: number | null;
  median_streak_length: number | null;
}

interface StatsViewProps {
  activities: Activity[];
  compact?: boolean;
  benchmarkOptIn?: boolean;
  anniversary?: string | null;
  cohortData?: BenchmarkCohort | null;
  onViewYearInReview?: (year: number) => void;
}

type Period = "week" | "month" | "year";

function getCohortLabel(cohortKey: string): string {
  const labels: Record<string, string> = {
    "rel_0-1": "0-1 years",
    "rel_1-3": "1-3 years",
    "rel_3-7": "3-7 years",
    "rel_7-15": "7-15 years",
    "rel_15+": "15+ years",
  };
  return labels[cohortKey] || cohortKey;
}

function TrendBadge({ difference, label = "vs previous" }: { difference: number; label?: string }) {
  const Icon = difference > 0 ? TrendingUp : difference < 0 ? TrendingDown : Minus;
  const color = difference > 0 ? "#22c55e" : difference < 0 ? "#ef4444" : colors.mutedForeground;
  return (
    <View style={styles.trendRow}>
      <Icon size={14} color={color} />
      <Text style={[styles.trendText, { color }]}>
        {difference > 0 ? "+" : ""}
        {difference}
      </Text>
      <Text style={styles.trendMuted}>{label}</Text>
    </View>
  );
}

function StatCard({ title, current, difference }: { title: string; current: number; difference: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{title}</Text>
      <Text style={styles.bigNumber}>{current}</Text>
      <TrendBadge difference={difference} />
    </View>
  );
}

function SimpleStatCard({
  icon: Icon,
  title,
  value,
  color = colors.primary,
  difference,
  comparisonLabel,
}: {
  icon: LucideIcon;
  title: string;
  value: number;
  color?: string;
  difference?: number;
  comparisonLabel?: string;
}) {
  return (
    <View style={[styles.card, styles.simpleCard]}>
      <View style={styles.simpleCardText}>
        <Text style={styles.cardLabel} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.mediumNumber, { color }]}>{value}</Text>
        {difference !== undefined && <TrendBadge difference={difference} label={comparisonLabel} />}
      </View>
      <Icon size={28} color={color} />
    </View>
  );
}

export default function StatsView({
  activities,
  compact = false,
  benchmarkOptIn = false,
  anniversary = null,
  cohortData = null,
  onViewYearInReview,
}: StatsViewProps) {
  const periodStats = usePeriodStats(activities);

  const calculateStreaks = useMemo(() => {
    if (activities.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const sortedActivities = [...activities].sort(
      (a, b) => new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime(),
    );

    const uniqueWeeks = Array.from(
      new Set(
        sortedActivities.map((a) => startOfWeek(new Date(a.activity_date), { weekStartsOn: 1 }).getTime()),
      ),
    )
      .map((time) => new Date(time))
      .sort((a, b) => a.getTime() - b.getTime());

    if (uniqueWeeks.length === 0) return { currentStreak: 0, longestStreak: 0 };

    let longestStreak = 1;
    let currentStreakCount = 1;
    for (let i = 1; i < uniqueWeeks.length; i++) {
      const weeksDiff = Math.round(differenceInDays(uniqueWeeks[i], uniqueWeeks[i - 1]) / 7);
      if (weeksDiff === 1) {
        currentStreakCount++;
        longestStreak = Math.max(longestStreak, currentStreakCount);
      } else {
        currentStreakCount = 1;
      }
    }

    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    let currentStreak = 0;
    const lastActivityWeek = uniqueWeeks[uniqueWeeks.length - 1];
    const weeksFromLastActivity = Math.round(differenceInDays(currentWeekStart, lastActivityWeek) / 7);

    if (weeksFromLastActivity <= 1) {
      currentStreak = 1;
      for (let i = uniqueWeeks.length - 2; i >= 0; i--) {
        const weeksDiff = Math.round(differenceInDays(uniqueWeeks[i + 1], uniqueWeeks[i]) / 7);
        if (weeksDiff === 1) currentStreak++;
        else break;
      }
    }

    return { currentStreak, longestStreak };
  }, [activities]);

  const calculateStats = (period: Period) => {
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case "week":
        currentStart = startOfWeek(now, { weekStartsOn: 1 });
        previousStart = subWeeks(currentStart, 1);
        previousEnd = currentStart;
        break;
      case "month":
        currentStart = startOfMonth(now);
        previousStart = subMonths(currentStart, 1);
        previousEnd = currentStart;
        break;
      case "year":
        currentStart = startOfYear(now);
        previousStart = subYears(currentStart, 1);
        previousEnd = currentStart;
        break;
    }

    const currentCount = activities.filter((a) =>
      isWithinInterval(new Date(a.activity_date), { start: currentStart, end: now }),
    ).length;
    const previousCount = activities.filter((a) =>
      isWithinInterval(new Date(a.activity_date), { start: previousStart, end: previousEnd }),
    ).length;

    return { currentCount, previousCount, difference: currentCount - previousCount };
  };

  const weekStats = useMemo(() => calculateStats("week"), [activities]);
  const monthStats = useMemo(() => calculateStats("month"), [activities]);
  const yearStats = useMemo(() => calculateStats("year"), [activities]);

  const bestMonth = useMemo(() => {
    if (activities.length === 0) return null;
    const monthCounts = new Map<string, { count: number; month: string; year: number }>();
    activities.forEach((activity) => {
      const date = new Date(activity.activity_date);
      const monthKey = format(date, "yyyy-MM");
      if (!monthCounts.has(monthKey)) {
        monthCounts.set(monthKey, { count: 0, month: format(date, "MMMM"), year: date.getFullYear() });
      }
      monthCounts.get(monthKey)!.count++;
    });
    let best = { count: 0, month: "", year: 0 };
    monthCounts.forEach((entry) => {
      if (entry.count > best.count) best = entry;
    });
    return best.count > 0 ? best : null;
  }, [activities]);

  const bestWeek = useMemo(() => {
    if (activities.length === 0) return null;
    const weekCounts = new Map<string, { count: number; weekStart: Date; weekEnd: Date }>();
    activities.forEach((activity) => {
      const date = new Date(activity.activity_date);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const weekKey = format(weekStart, "yyyy-MM-dd");
      if (!weekCounts.has(weekKey)) weekCounts.set(weekKey, { count: 0, weekStart, weekEnd });
      weekCounts.get(weekKey)!.count++;
    });
    let best = { count: 0, weekStart: new Date(), weekEnd: new Date() };
    weekCounts.forEach((entry) => {
      if (entry.count > best.count) best = entry;
    });
    return best.count > 0 ? best : null;
  }, [activities]);

  const bestYear = useMemo(() => {
    if (activities.length === 0) return null;
    const yearCounts = new Map<number, number>();
    activities.forEach((a) => {
      const year = new Date(a.activity_date).getFullYear();
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    });
    let best = { count: 0, year: 0 };
    yearCounts.forEach((count, year) => {
      if (count > best.count) best = { count, year };
    });
    return best.count > 0 ? best : null;
  }, [activities]);

  const rolling4WeeksCount = useMemo(() => {
    const fourWeeksAgo = subWeeks(new Date(), 4);
    return activities.filter((a) => new Date(a.activity_date) >= fourWeeksAgo).length;
  }, [activities]);

  const consistencyScore = useMemo(() => {
    const now = new Date();
    const weekCounts = new Map<string, number>();
    for (let i = 0; i < 8; i++) {
      weekCounts.set(format(startOfWeek(subWeeks(now, i), { weekStartsOn: 1 }), "yyyy-MM-dd"), 0);
    }
    activities.forEach((a) => {
      const weekKey = format(startOfWeek(new Date(a.activity_date), { weekStartsOn: 1 }), "yyyy-MM-dd");
      if (weekCounts.has(weekKey)) weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + 1);
    });
    let score = 0;
    weekCounts.forEach((count) => {
      if (count >= 1) score += 12;
      if (count >= 2) score += 2;
    });
    return Math.min(score, 100);
  }, [activities]);

  const streakHealth = useMemo(() => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const dayOfWeek = getDay(now);
    const hasLoggedThisWeek = activities.some((a) => new Date(a.activity_date) >= currentWeekStart);
    if (hasLoggedThisWeek) return "safe" as const;
    if (dayOfWeek === 0) return "atRisk" as const;
    if (dayOfWeek >= 4) return "watch" as const;
    return "safe" as const;
  }, [activities]);

  const getTimeOfDayComparison = (key: keyof typeof periodStats.timeOfDay) => {
    const current = periodStats.timeOfDay[key];
    const comparison = periodStats.comparisonTimeOfDay[key];
    return { current, difference: current - comparison };
  };

  const getBunnyComparison = (type: "doubleDays" | "tripleDays") => {
    const current = periodStats.bunnyDays[type];
    const comparison = periodStats.comparisonBunnyDays[type];
    return { current, difference: current - comparison };
  };

  if (compact) {
    return (
      <View style={styles.grid2}>
        <SimpleStatCard icon={Flame} title="Current Streak" value={calculateStreaks.currentStreak} color="#f97316" />
        <SimpleStatCard icon={Calendar} title="Longest Streak" value={calculateStreaks.longestStreak} color={colors.primary} />
      </View>
    );
  }

  const previousYear = new Date().getFullYear() - 1;
  const hasPreviousYearData = activities.some((a) => new Date(a.activity_date).getFullYear() === previousYear);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Statistics</Text>

      <View style={styles.grid1}>
        <StatCard title="This Week" current={weekStats.currentCount} difference={weekStats.difference} />
        <StatCard title="This Month" current={monthStats.currentCount} difference={monthStats.difference} />
        <StatCard title="This Year" current={yearStats.currentCount} difference={yearStats.difference} />
      </View>

      <Text style={styles.subTitle}>Consistency</Text>
      <View style={styles.grid2}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Consistency Score</Text>
          <Text style={styles.bigNumber}>{consistencyScore}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${consistencyScore}%` }]} />
          </View>
          <Text style={styles.captionText}>Based on your last 8 weeks of activity</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Streak Health</Text>
          <View style={styles.streakHealthRow}>
            {streakHealth === "safe" && (
              <>
                <CheckCircle size={20} color="#22c55e" />
                <View style={[styles.badge, { borderColor: "#22c55e66" }]}>
                  <Text style={[styles.badgeText, { color: "#16a34a" }]}>Safe</Text>
                </View>
              </>
            )}
            {streakHealth === "watch" && (
              <>
                <AlertTriangle size={20} color="#f59e0b" />
                <View style={[styles.badge, { borderColor: "#f59e0b66" }]}>
                  <Text style={[styles.badgeText, { color: "#d97706" }]}>Watch</Text>
                </View>
              </>
            )}
            {streakHealth === "atRisk" && (
              <>
                <Shield size={20} color="#ef4444" />
                <View style={[styles.badge, { borderColor: "#ef444466" }]}>
                  <Text style={[styles.badgeText, { color: "#dc2626" }]}>At Risk</Text>
                </View>
              </>
            )}
            <Text style={styles.streakCount}>{calculateStreaks.currentStreak}w</Text>
          </View>
          <Text style={styles.captionText}>
            {streakHealth === "safe" && "You're on track this week!"}
            {streakHealth === "watch" && "Weekend approaching — time to connect?"}
            {streakHealth === "atRisk" && "Last chance to log before the week ends!"}
          </Text>
        </View>
      </View>

      {(bestMonth || bestWeek || bestYear) && (
        <>
          <Text style={styles.subTitle}>Best Periods</Text>
          <View style={styles.grid1}>
            {bestYear && (
              <View style={[styles.card, styles.simpleCard]}>
                <View style={styles.simpleCardText}>
                  <Text style={styles.cardLabel}>Best Year</Text>
                  <Text style={styles.mediumNumber}>{bestYear.year}</Text>
                  <Text style={styles.captionText}>
                    {bestYear.count} {bestYear.count === 1 ? "activity" : "activities"}
                  </Text>
                </View>
                <Rabbit size={28} color="#eab308" />
              </View>
            )}
            {bestMonth && (
              <View style={[styles.card, styles.simpleCard]}>
                <View style={styles.simpleCardText}>
                  <Text style={styles.cardLabel}>Best Month</Text>
                  <Text style={styles.mediumNumber}>
                    {bestMonth.month} {bestMonth.year}
                  </Text>
                  <Text style={styles.captionText}>
                    {bestMonth.count} {bestMonth.count === 1 ? "activity" : "activities"}
                  </Text>
                </View>
                <Calendar size={28} color={colors.primary} />
              </View>
            )}
            {bestWeek && (
              <View style={[styles.card, styles.simpleCard]}>
                <View style={styles.simpleCardText}>
                  <Text style={styles.cardLabel}>Best Week</Text>
                  <Text style={styles.mediumNumber}>
                    {format(bestWeek.weekStart, "MMM d")} - {format(bestWeek.weekEnd, "MMM d")}
                  </Text>
                  <Text style={styles.captionText}>
                    {bestWeek.count} {bestWeek.count === 1 ? "activity" : "activities"}
                  </Text>
                </View>
                <Flame size={28} color="#f97316" />
              </View>
            )}
          </View>
        </>
      )}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.subTitle}>Even more stats</Text>
        <PeriodPicker
          period={periodStats.period}
          comparison={periodStats.comparison}
          onPeriodChange={periodStats.setPeriod}
          onComparisonChange={periodStats.setComparison}
        />
      </View>

      <View style={styles.grid2}>
        <SimpleStatCard icon={Rabbit} title="Double Days" value={getBunnyComparison("doubleDays").current} color="#3b82f6" difference={getBunnyComparison("doubleDays").difference} comparisonLabel={comparisonLabels[periodStats.comparison]} />
        <SimpleStatCard icon={Rabbit} title="Triple Days" value={getBunnyComparison("tripleDays").current} color="#a855f7" difference={getBunnyComparison("tripleDays").difference} comparisonLabel={comparisonLabels[periodStats.comparison]} />
      </View>

      <View style={styles.grid2}>
        <SimpleStatCard icon={Sunrise} title="Early Bird" value={getTimeOfDayComparison("earlyBird").current} color="#f59e0b" difference={getTimeOfDayComparison("earlyBird").difference} comparisonLabel={comparisonLabels[periodStats.comparison]} />
        <SimpleStatCard icon={Coffee} title="Lazy Morning" value={getTimeOfDayComparison("lazyMorning").current} color="#a16207" difference={getTimeOfDayComparison("lazyMorning").difference} comparisonLabel={comparisonLabels[periodStats.comparison]} />
        <SimpleStatCard icon={Sun} title="Nooner" value={getTimeOfDayComparison("nooner").current} color="#eab308" difference={getTimeOfDayComparison("nooner").difference} comparisonLabel={comparisonLabels[periodStats.comparison]} />
        <SimpleStatCard icon={Sunset} title="Afternoon Delight" value={getTimeOfDayComparison("afternoon").current} color="#fb923c" difference={getTimeOfDayComparison("afternoon").difference} comparisonLabel={comparisonLabels[periodStats.comparison]} />
        <SimpleStatCard icon={Stars} title="Evening Bliss" value={getTimeOfDayComparison("evening").current} color="#a855f7" difference={getTimeOfDayComparison("evening").difference} comparisonLabel={comparisonLabels[periodStats.comparison]} />
        <SimpleStatCard icon={Moon} title="Night Owl" value={getTimeOfDayComparison("nightOwl").current} color="#6366f1" difference={getTimeOfDayComparison("nightOwl").difference} comparisonLabel={comparisonLabels[periodStats.comparison]} />
      </View>

      {benchmarkOptIn && (
        <>
          <View style={styles.rowGap}>
            <Users size={18} color={colors.primary} />
            <Text style={styles.subTitle}>Benchmarks</Text>
          </View>
          <Text style={styles.captionText}>
            {cohortData
              ? `Comparing with couples together ${getCohortLabel(cohortData.cohort_key)}`
              : anniversary
              ? "Comparing with similar couples"
              : "Set your anniversary in Profile to see cohort comparisons"}
          </Text>

          {cohortData ? (
            <View style={styles.grid1}>
              {[
                { label: "This Month", value: monthStats.currentCount, median: cohortData.median_monthly_count },
                { label: "Last 4 Weeks", value: rolling4WeeksCount, median: cohortData.median_rolling_4_weeks },
                { label: "Consistency", value: consistencyScore, median: cohortData.median_consistency_score },
                { label: "Current Streak", value: calculateStreaks.currentStreak, median: cohortData.median_streak_length },
              ].map((row) => (
                <View key={row.label} style={styles.card}>
                  <View style={styles.benchmarkRow}>
                    <View>
                      <Text style={styles.cardLabel}>{row.label}</Text>
                      <Text style={styles.mediumNumber}>{row.value}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.captionText}>Cohort median</Text>
                      <Text style={styles.medianText}>{row.median?.toFixed(1) ?? "—"}</Text>
                    </View>
                  </View>
                  {row.median != null && (
                    <View style={styles.trendRow}>
                      {row.value >= row.median ? (
                        <>
                          <ArrowUp size={12} color="#22c55e" />
                          <Text style={{ color: "#16a34a", fontSize: 12 }}>Above cohort median</Text>
                        </>
                      ) : (
                        <>
                          <ArrowDown size={12} color="#f59e0b" />
                          <Text style={{ color: "#d97706", fontSize: 12 }}>Slightly under cohort median</Text>
                        </>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.card, { alignItems: "center" }]}>
              <Users size={36} color={colors.mutedForeground} />
              <Text style={[styles.captionText, { textAlign: "center", marginTop: spacing.xs }]}>
                {anniversary
                  ? "Benchmark data will appear once computed. Check back soon!"
                  : "Set your anniversary date in Profile to see how you compare to similar couples."}
              </Text>
            </View>
          )}
        </>
      )}

      {hasPreviousYearData && onViewYearInReview && (
        <Pressable style={styles.yirCard} onPress={() => onViewYearInReview(previousYear)}>
          <View style={styles.rowGap}>
            <Sparkles size={28} color={colors.primary} />
            <View>
              <Text style={styles.cardLabel}>Year in Review</Text>
              <Text style={styles.captionText}>Relive your {previousYear} highlights</Text>
            </View>
          </View>
          <Text style={styles.viewLink}>View</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
  },
  subTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  rowGap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  grid1: {
    gap: spacing.sm,
  },
  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary + "1a",
    padding: spacing.md,
  },
  simpleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  simpleCardText: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  bigNumber: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  mediumNumber: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "600",
  },
  trendMuted: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.muted,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  captionText: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  streakHealthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  streakCount: {
    marginLeft: "auto",
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  benchmarkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  medianText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  yirCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary + "0d",
    borderWidth: 2,
    borderColor: colors.primary + "33",
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  viewLink: {
    color: colors.primary,
    fontWeight: "600",
  },
});
