// Ported from src/pages/YearInReview.tsx. Same stats calculation logic
// (best month/week, longest streak, time-of-day ranking, top emojis,
// bunny days, YoY comparison) as the web version. Differences forced by
// the platform:
//  - CSS gradients -> expo-linear-gradient
//  - keyboard arrow nav -> tap zones (left/right) + explicit chevron buttons
//  - react-router params -> route.params via React Navigation
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Dimensions, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Sparkles,
  Flame,
  Calendar,
  Trophy,
  Rabbit,
  Sunrise,
  Coffee,
  Sun,
  Sunset,
  Stars,
  Moon,
  LucideIcon,
} from "lucide-react-native";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "../integrations/supabase/client";
import { getEmojiLabel } from "../lib/emojiLabels";
import { colors, spacing } from "../theme/colors";

interface Activity {
  id: string;
  activity_date: string;
  emoji: string | null;
  notes: string | null;
}

const TIME_BUCKETS: Record<string, { label: string; Icon: LucideIcon; statement: string }> = {
  nightOwl: { label: "Night Owl", Icon: Moon, statement: "The night is yours. Don't fight it." },
  earlyBird: { label: "Early Bird", Icon: Sunrise, statement: "Early mornings are your thing. Embrace it." },
  morningDelight: { label: "Lazy Morning", Icon: Coffee, statement: "Lazy mornings work for you. Keep it cozy." },
  afternoonAdventure: { label: "Afternoon Delight", Icon: Sunset, statement: "Afternoon delight is real. Own it." },
  eveningBliss: { label: "Evening Bliss", Icon: Stars, statement: "Evenings are your time. Make them count." },
  lateNight: { label: "Late Night", Icon: Moon, statement: "Late nights are your thing. Don't apologize." },
};

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Slide = { id: string; gradient: string[]; content: React.ReactNode };

export default function YearInReviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const reviewYear: number = route.params?.year ?? new Date().getFullYear() - 1;

  const [userId, setUserId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [partnerName, setPartnerName] = useState("your partner");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) {
        navigation.goBack();
        return;
      }
      setUserId(uid);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const { data: partnerId } = await supabase.rpc("get_partner_id", { user_id: userId });

      if (partnerId) {
        const { data: partnerProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", partnerId)
          .maybeSingle();
        if (partnerProfile?.name) setPartnerName(partnerProfile.name);
      }

      const userIds = partnerId ? [userId, partnerId] : [userId];
      const { data } = await supabase
        .from("activities")
        .select("*")
        .in("user_id", userIds)
        .order("activity_date", { ascending: false });

      setActivities(data || []);
      setLoading(false);
    })();
  }, [userId]);

  const yearActivities = useMemo(
    () => activities.filter((a) => new Date(a.activity_date).getFullYear() === reviewYear),
    [activities, reviewYear],
  );

  const stats = useMemo(() => {
    if (yearActivities.length === 0) return null;
    const total = yearActivities.length;

    const monthCounts: Record<string, number> = {};
    yearActivities.forEach((a) => {
      const month = format(new Date(a.activity_date), "MMMM");
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const sortedMonths = Object.entries(monthCounts).sort((a, b) => b[1] - a[1]);
    const bestMonth = sortedMonths[0] ? { name: sortedMonths[0][0], count: sortedMonths[0][1] } : null;

    const weekCounts: Record<string, { count: number; start: Date; end: Date }> = {};
    yearActivities.forEach((a) => {
      const date = new Date(a.activity_date);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
      const key = format(weekStart, "yyyy-MM-dd");
      if (!weekCounts[key]) weekCounts[key] = { count: 0, start: weekStart, end: weekEnd };
      weekCounts[key].count++;
    });
    const sortedWeeks = Object.entries(weekCounts).sort((a, b) => b[1].count - a[1].count);
    const bestWeek = sortedWeeks[0]
      ? { range: `${format(sortedWeeks[0][1].start, "MMM d")} - ${format(sortedWeeks[0][1].end, "MMM d")}`, count: sortedWeeks[0][1].count }
      : null;

    const weeksWithActivity = new Set<string>();
    yearActivities.forEach((a) => {
      const date = new Date(a.activity_date);
      const week = getWeekNumber(date);
      weeksWithActivity.add(`${date.getFullYear()}-${week.toString().padStart(2, "0")}`);
    });
    const sortedWeekKeys = Array.from(weeksWithActivity).sort();
    let longestStreak = 1;
    let currentStreak = 1;
    for (let i = 1; i < sortedWeekKeys.length; i++) {
      const [prevYear, prevWeek] = sortedWeekKeys[i - 1].split("-").map(Number);
      const [currYear, currWeek] = sortedWeekKeys[i].split("-").map(Number);
      const isConsecutive =
        (currYear === prevYear && currWeek === prevWeek + 1) || (currYear === prevYear + 1 && prevWeek >= 52 && currWeek === 1);
      if (isConsecutive) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    const activeWeeks = weeksWithActivity.size;

    const timeOfDay: Record<string, number> = {
      nightOwl: 0,
      earlyBird: 0,
      morningDelight: 0,
      afternoonAdventure: 0,
      eveningBliss: 0,
      lateNight: 0,
    };
    yearActivities.forEach((a) => {
      const hour = new Date(a.activity_date).getHours();
      if (hour >= 0 && hour < 6) timeOfDay.nightOwl++;
      else if (hour >= 6 && hour < 9) timeOfDay.earlyBird++;
      else if (hour >= 9 && hour < 12) timeOfDay.morningDelight++;
      else if (hour >= 12 && hour < 17) timeOfDay.afternoonAdventure++;
      else if (hour >= 17 && hour < 21) timeOfDay.eveningBliss++;
      else timeOfDay.lateNight++;
    });
    const timeOfDayRanking = Object.entries(timeOfDay)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ key, label: TIME_BUCKETS[key]?.label || key, count, percentage: Math.round((count / total) * 100) }));

    const emojiCounts: Record<string, number> = {};
    yearActivities.forEach((a) => {
      if (a.emoji) emojiCounts[a.emoji] = (emojiCounts[a.emoji] || 0) + 1;
    });
    const topEmojis = Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emoji, count]) => ({ emoji, label: getEmojiLabel(emoji), count, percentage: Math.round((count / total) * 100) }));
    const emojiVariety = Object.keys(emojiCounts).length;

    const dayCounts: Record<string, number> = {};
    yearActivities.forEach((a) => {
      const dateKey = format(new Date(a.activity_date), "yyyy-MM-dd");
      dayCounts[dateKey] = (dayCounts[dateKey] || 0) + 1;
    });
    let doubleDays = 0;
    let tripleDays = 0;
    Object.values(dayCounts).forEach((count) => {
      if (count === 2) doubleDays++;
      else if (count >= 3) tripleDays++;
    });

    const prevYearActivities = activities.filter((a) => new Date(a.activity_date).getFullYear() === reviewYear - 1);
    const yoyChange = prevYearActivities.length > 0 ? total - prevYearActivities.length : null;

    return { total, bestMonth, bestWeek, longestStreak, activeWeeks, timeOfDayRanking, topEmojis, emojiVariety, doubleDays, tripleDays, yoyChange };
  }, [yearActivities, activities, reviewYear]);

  const slides: Slide[] = useMemo(() => {
    if (!stats) return [];
    const list: (Slide | false)[] = [
      {
        id: "intro",
        gradient: [colors.primary, colors.accent],
        content: (
          <View style={styles.centerContent}>
            <Sparkles size={56} color="#ffffffcc" />
            <Text style={styles.hugeNumber}>{reviewYear}</Text>
            <Text style={styles.slideSubtitle}>Your Year in Review</Text>
            <Text style={styles.slideCaption}>with {partnerName}</Text>
          </View>
        ),
      },
      {
        id: "total",
        gradient: ["#f97316", "#ef4444", "#ec4899"],
        content: (
          <View style={styles.centerContent}>
            <Flame size={56} color="#ffffffcc" />
            <Text style={styles.slideSubtitle}>You shared</Text>
            <Text style={styles.hugeNumber}>{stats.total}</Text>
            <Text style={styles.slideBody}>intimate moments in {reviewYear}</Text>
            {stats.yoyChange !== null && (
              <Text style={styles.slideCaption}>
                {stats.yoyChange > 0 ? `Up ${stats.yoyChange}` : stats.yoyChange < 0 ? `Down ${Math.abs(stats.yoyChange)}` : "Same as"} from last year
              </Text>
            )}
          </View>
        ),
      },
      stats.bestMonth ? {
        id: "best-month",
        gradient: ["#8b5cf6", "#a855f7", "#d946ef"],
        content: (
          <View style={styles.centerContent}>
            <Calendar size={56} color="#ffffffcc" />
            <Text style={styles.slideSubtitle}>Your hottest month was</Text>
            <Text style={styles.bigTitle}>{stats.bestMonth.name}</Text>
            <Text style={styles.slideBody}>with {stats.bestMonth.count} moments</Text>
          </View>
        ),
      } : false,
      {
        id: "streak",
        gradient: ["#f59e0b", "#f97316", "#ef4444"],
        content: (
          <View style={styles.centerContent}>
            <Trophy size={56} color="#ffffffcc" />
            <Text style={styles.slideSubtitle}>Your longest streak was</Text>
            <Text style={styles.hugeNumber}>{stats.longestStreak}</Text>
            <Text style={styles.slideBody}>consecutive weeks</Text>
            <Text style={styles.slideCaption}>That's {stats.activeWeeks} active weeks total</Text>
          </View>
        ),
      },
      stats.timeOfDayRanking.length > 0 && {
        id: "time-of-day",
        gradient: ["#6366f1", "#3b82f6", "#06b6d4"],
        content: (() => {
          const TopIcon = TIME_BUCKETS[stats.timeOfDayRanking[0].key]?.Icon || Moon;
          return (
            <View style={styles.centerContent}>
              <TopIcon size={56} color="#ffffffcc" />
              <Text style={styles.bigTitle}>
                {TIME_BUCKETS[stats.timeOfDayRanking[0].key]?.statement || `${stats.timeOfDayRanking[0].label} is your time.`}
              </Text>
              <View style={styles.rankList}>
                {stats.timeOfDayRanking.slice(1).map((slot, i) => {
                  const SlotIcon = TIME_BUCKETS[slot.key]?.Icon || Moon;
                  return (
                    <View key={slot.key} style={styles.rankRow}>
                      <Text style={styles.rankIndex}>{i + 2}.</Text>
                      <SlotIcon size={18} color="#ffffffcc" />
                      <Text style={styles.rankLabel}>{slot.label}</Text>
                      <Text style={styles.rankCount}>{slot.count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })(),
      },
      stats.topEmojis.length > 0 && {
        id: "emojis",
        gradient: ["#ec4899", "#f43f5e", "#ef4444"],
        content: (
          <View style={styles.centerContent}>
            <Text style={styles.hugeEmoji}>{stats.topEmojis[0].emoji}</Text>
            <Text style={styles.bigTitle}>{stats.topEmojis[0].label} is your signature move.</Text>
            <View style={styles.rankList}>
              {stats.topEmojis.slice(1).map((item, i) => (
                <View key={item.emoji} style={styles.rankRow}>
                  <Text style={styles.rankIndex}>{i + 2}.</Text>
                  <Text style={styles.rankEmoji}>{item.emoji}</Text>
                  <Text style={styles.rankLabel}>{item.label}</Text>
                  <Text style={styles.rankCount}>{item.count}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.slideCaption}>{stats.emojiVariety} different vibes explored</Text>
          </View>
        ),
      },
      (stats.doubleDays > 0 || stats.tripleDays > 0) && {
        id: "bunny-days",
        gradient: ["#10b981", "#14b8a6", "#06b6d4"],
        content: (
          <View style={styles.centerContent}>
            <Rabbit size={56} color="#ffffffcc" />
            <Text style={styles.slideSubtitle}>Some days were extra special</Text>
            {stats.tripleDays > 0 && (
              <>
                <Text style={styles.hugeNumber}>{stats.tripleDays}</Text>
                <Text style={styles.slideBody}>triple days 🐰🐰🐰</Text>
              </>
            )}
            {stats.doubleDays > 0 && (
              <>
                <Text style={styles.bigTitle}>{stats.doubleDays}</Text>
                <Text style={styles.slideBody}>double days 🐰🐰</Text>
              </>
            )}
          </View>
        ),
      },
      {
        id: "outro",
        gradient: [colors.primary, colors.accent],
        content: (
          <View style={styles.centerContent}>
            <Text style={styles.hugeEmoji}>❤️</Text>
            <Text style={styles.bigTitle}>Here's to another year</Text>
            <Text style={styles.slideBody}>of love, laughter and most importantly, {partnerName}</Text>
            <Text style={styles.hugeNumber}>{reviewYear + 1}</Text>
          </View>
        ),
      },
    ];
    return list.filter(Boolean) as Slide[];
  }, [stats, reviewYear, partnerName]);

  const goToSlide = (index: number) => {
    if (index < 0 || index >= slides.length) return;
    setCurrentSlide(index);
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <Sparkles size={40} color={colors.primary} />
        <Text style={styles.loadingText}>Loading your year...</Text>
      </View>
    );
  }

  if (!stats || yearActivities.length === 0) {
    return (
      <View style={styles.loadingScreen}>
        <Calendar size={40} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>No moments found</Text>
        <Text style={styles.loadingText}>You don't have any logged moments in {reviewYear} to review.</Text>
        <Pressable style={styles.homeButtonAlt} onPress={() => navigation.goBack()}>
          <Home size={16} color={colors.primaryForeground} />
          <Text style={styles.homeButtonAltText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  const slide = slides[currentSlide];

  return (
    <View style={styles.container}>
      <LinearGradient colors={slide.gradient as any} style={styles.gradient}>
        <Pressable style={styles.tapZoneLeft} onPress={() => goToSlide(currentSlide - 1)} />
        <Pressable style={styles.tapZoneRight} onPress={() => goToSlide(currentSlide + 1)} />

        <View style={styles.slideContent}>{slide.content}</View>

        <View style={styles.navOverlay}>
          <View style={styles.dotsRow}>
            {slides.map((_, i) => (
              <Pressable key={i} onPress={() => goToSlide(i)}>
                <View style={[styles.navDot, i === currentSlide && styles.navDotActive]} />
              </Pressable>
            ))}
          </View>

          <View style={styles.navButtonsRow}>
            <Pressable onPress={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0} style={styles.navIconButton}>
              <ChevronLeft size={24} color="#fff" style={{ opacity: currentSlide === 0 ? 0.3 : 1 }} />
            </Pressable>
            <Pressable onPress={() => navigation.goBack()} style={styles.homeButton}>
              <Home size={16} color="#fff" />
              <Text style={styles.homeButtonText}>Home</Text>
            </Pressable>
            <Pressable onPress={() => goToSlide(currentSlide + 1)} disabled={currentSlide === slides.length - 1} style={styles.navIconButton}>
              <ChevronRight size={24} color="#fff" style={{ opacity: currentSlide === slides.length - 1 ? 0.3 : 1 }} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    color: colors.mutedForeground,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
  },
  homeButtonAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  homeButtonAltText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  tapZoneLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH / 3,
    zIndex: 1,
  },
  tapZoneRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH / 3,
    zIndex: 1,
  },
  slideContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  centerContent: {
    alignItems: "center",
    gap: spacing.md,
  },
  hugeNumber: {
    fontSize: 72,
    fontWeight: "800",
    color: "#fff",
  },
  bigTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  hugeEmoji: {
    fontSize: 56,
  },
  slideSubtitle: {
    fontSize: 18,
    color: "#ffffffcc",
    textAlign: "center",
  },
  slideBody: {
    fontSize: 20,
    color: "#ffffffe6",
    textAlign: "center",
  },
  slideCaption: {
    fontSize: 15,
    color: "#ffffffb3",
    textAlign: "center",
  },
  rankList: {
    gap: spacing.sm,
    width: "100%",
    maxWidth: 280,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rankIndex: {
    fontSize: 18,
    color: "#ffffffcc",
    width: 20,
  },
  rankEmoji: {
    fontSize: 24,
  },
  rankLabel: {
    flex: 1,
    fontSize: 15,
    color: "#ffffffe6",
  },
  rankCount: {
    fontSize: 13,
    color: "#ffffffb3",
  },
  navOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    zIndex: 2,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  navDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff66",
  },
  navDotActive: {
    width: 24,
    backgroundColor: "#fff",
  },
  navButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navIconButton: {
    padding: spacing.sm,
  },
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  homeButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
