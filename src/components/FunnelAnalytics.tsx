// Ported from src/components/FunnelAnalytics.tsx. Same event-based funnel
// calculation logic (signup funnel, activation funnel, time-to-activity/
// couple, retention) as the web version. Progress bars replace shadcn's
// Progress component 1:1 (same underlying percentage values).
import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { ArrowRight, Users, Heart, Zap, Clock, SkipForward, CalendarDays } from "lucide-react-native";
import { supabase } from "../integrations/supabase/client";
import { colors, radius, spacing } from "../theme/colors";

interface FunnelStep {
  name: string;
  count: number;
  percentage: number;
}

interface MetricCard {
  label: string;
  value: string;
  Icon: any;
  description: string;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(value, 100)}%` }]} />
    </View>
  );
}

function FunnelCard({ title, Icon, steps }: { title: string; Icon: any; steps: FunnelStep[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Icon size={18} color={colors.foreground} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        {steps.map((step, index) => (
          <View key={step.name}>
            <View style={styles.stepRow}>
              <View style={styles.stepLabelRow}>
                {index > 0 && <ArrowRight size={12} color={colors.mutedForeground} />}
                <Text style={styles.stepLabel}>{step.name}</Text>
              </View>
              <Text style={styles.stepValue}>
                {step.count} ({step.percentage}%)
              </Text>
            </View>
            <ProgressBar value={step.percentage} />
          </View>
        ))}
      </View>
    </View>
  );
}

function formatEventName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function FunnelAnalytics() {
  const [signupFunnel, setSignupFunnel] = useState<FunnelStep[]>([]);
  const [activationFunnel, setActivationFunnel] = useState<FunnelStep[]>([]);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [events, setEvents] = useState<Array<{ event_name: string; created_at: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFunnelData();
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from("user_events")
      .select("event_name, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setEvents(data || []);
  };

  const fetchFunnelData = async () => {
    try {
      setLoading(true);

      const { data: testUserRoles } = await supabase.from("user_roles").select("user_id").eq("role", "test_user");
      const testUserIds = new Set(testUserRoles?.map((r) => r.user_id) || []);

      const { data: allEvents } = await supabase.from("user_events").select("*").order("created_at", { ascending: false });
      const evts = allEvents?.filter((e) => !testUserIds.has(e.user_id));

      const { data: allProfiles } = await supabase.from("profiles").select("user_id, signup_at, created_at");
      const profiles = allProfiles?.filter((p) => !testUserIds.has(p.user_id));

      const { data: allCouples } = await supabase.from("couples").select("user1_id, user2_id, created_at");
      const couples = allCouples?.filter((c) => !testUserIds.has(c.user1_id) && !testUserIds.has(c.user2_id));

      const { data: allActivities } = await supabase.from("activities").select("user_id, created_at").order("created_at", { ascending: true });
      const activities = allActivities?.filter((a) => !testUserIds.has(a.user_id));

      const signupStarted = new Set(evts?.filter((e) => e.event_name === "signup_started").map((e) => e.user_id)).size;
      const signupCompleted = new Set(evts?.filter((e) => e.event_name === "signup_completed").map((e) => e.user_id)).size;
      const onboardingStarted = new Set(evts?.filter((e) => e.event_name === "onboarding_started").map((e) => e.user_id)).size;
      const onboardingCompleted = new Set(evts?.filter((e) => e.event_name === "onboarding_completed").map((e) => e.user_id)).size;

      const totalProfiles = profiles?.length || 0;
      const usersWithActivities = new Set(activities?.map((a) => a.user_id)).size;
      const signupBase = signupStarted || totalProfiles;

      setSignupFunnel([
        { name: "Signup Started", count: signupStarted || totalProfiles, percentage: 100 },
        {
          name: "Signup Completed",
          count: signupCompleted || totalProfiles,
          percentage: signupBase > 0 ? Math.round(((signupCompleted || totalProfiles) / signupBase) * 100) : 0,
        },
        {
          name: "Onboarding Started",
          count: onboardingStarted || Math.round(totalProfiles * 0.9),
          percentage: signupBase > 0 ? Math.round(((onboardingStarted || Math.round(totalProfiles * 0.9)) / signupBase) * 100) : 0,
        },
        {
          name: "Onboarding Completed",
          count: onboardingCompleted || Math.round(totalProfiles * 0.8),
          percentage: signupBase > 0 ? Math.round(((onboardingCompleted || Math.round(totalProfiles * 0.8)) / signupBase) * 100) : 0,
        },
      ]);

      const coupledUsers = couples ? couples.length * 2 : 0;
      setActivationFunnel([
        { name: "Signed Up", count: totalProfiles, percentage: 100 },
        { name: "Coupled", count: coupledUsers, percentage: totalProfiles > 0 ? Math.round((coupledUsers / totalProfiles) * 100) : 0 },
        {
          name: "First Activity",
          count: usersWithActivities,
          percentage: totalProfiles > 0 ? Math.round((usersWithActivities / totalProfiles) * 100) : 0,
        },
      ]);

      const onboardingSkipped = evts?.filter((e) => e.event_name === "onboarding_skipped").length || 0;
      const onboardingTotal = (onboardingCompleted || 0) + onboardingSkipped;
      const skipRate = onboardingTotal > 0 ? Math.round((onboardingSkipped / onboardingTotal) * 100) : 0;

      const userFirstActivity: Record<string, Date> = {};
      activities?.forEach((a) => {
        if (!userFirstActivity[a.user_id]) userFirstActivity[a.user_id] = new Date(a.created_at);
      });
      const userSignup: Record<string, Date> = {};
      profiles?.forEach((p) => {
        userSignup[p.user_id] = new Date(p.signup_at || p.created_at);
      });

      const timesToFirstActivity: number[] = [];
      Object.keys(userFirstActivity).forEach((uid) => {
        if (userSignup[uid]) {
          const hours = (userFirstActivity[uid].getTime() - userSignup[uid].getTime()) / 3600000;
          if (hours >= 0) timesToFirstActivity.push(hours);
        }
      });
      const medianTimeToActivity =
        timesToFirstActivity.length > 0 ? timesToFirstActivity.sort((a, b) => a - b)[Math.floor(timesToFirstActivity.length / 2)] : 0;

      const timesToCouple: number[] = [];
      couples?.forEach((c) => {
        const coupleDate = new Date(c.created_at);
        [c.user1_id, c.user2_id].forEach((uid) => {
          if (userSignup[uid]) {
            const hours = (coupleDate.getTime() - userSignup[uid].getTime()) / 3600000;
            if (hours >= 0) timesToCouple.push(hours);
          }
        });
      });
      const medianTimeToCouple = timesToCouple.length > 0 ? timesToCouple.sort((a, b) => a - b)[Math.floor(timesToCouple.length / 2)] : 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const activeInLast7Days = new Set(activities?.filter((a) => new Date(a.created_at) > sevenDaysAgo).map((a) => a.user_id)).size;
      const retentionRate = usersWithActivities > 0 ? Math.round((activeInLast7Days / usersWithActivities) * 100) : 0;

      setMetrics([
        {
          label: "Time to First Activity",
          value: medianTimeToActivity > 24 ? `${Math.round(medianTimeToActivity / 24)}d` : `${Math.round(medianTimeToActivity)}h`,
          Icon: Clock,
          description: "Median time from signup",
        },
        {
          label: "Time to Couple",
          value: medianTimeToCouple > 24 ? `${Math.round(medianTimeToCouple / 24)}d` : `${Math.round(medianTimeToCouple)}h`,
          Icon: Heart,
          description: "Median time to connect",
        },
        { label: "Onboarding Skip Rate", value: `${skipRate}%`, Icon: SkipForward, description: "Users who skipped onboarding" },
        { label: "7-Day Retention", value: `${retentionRate}%`, Icon: CalendarDays, description: "Active users in last 7 days" },
      ]);
    } catch (error) {
      console.error("Error fetching funnel data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.mutedText}>Loading funnel analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.metricsGrid}>
        {metrics.map((m) => (
          <View key={m.label} style={styles.metricCard}>
            <View style={styles.metricIconRow}>
              <m.Icon size={18} color={colors.primary} />
              <Text style={styles.metricValue}>{m.value}</Text>
            </View>
            <Text style={styles.metricLabel}>{m.label}</Text>
            <Text style={styles.metricDescription}>{m.description}</Text>
          </View>
        ))}
      </View>

      <FunnelCard title="Signup Funnel" Icon={Users} steps={signupFunnel} />
      <FunnelCard title="Activation Funnel" Icon={Zap} steps={activationFunnel} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Events</Text>
        {events.length === 0 ? (
          <Text style={styles.mutedText}>No events tracked yet.</Text>
        ) : (
          <View style={{ gap: spacing.xs }}>
            {events.map((event, i) => (
              <View key={i} style={styles.eventRow}>
                <Text style={styles.eventName}>{formatEventName(event.event_name)}</Text>
                <Text style={styles.eventTime}>{formatTime(event.created_at)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: "center",
  },
  mutedText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  metricIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.foreground,
  },
  metricDescription: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  stepLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stepLabel: {
    fontSize: 13,
    color: colors.foreground,
  },
  stepValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.muted,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  eventRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  eventName: {
    fontSize: 13,
    color: colors.foreground,
  },
  eventTime: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
});
