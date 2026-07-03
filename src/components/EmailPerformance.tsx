// Ported from src/components/EmailPerformance.tsx. Same edge function
// calls (email-metrics for summary/recent, send-digest-manual /
// send-midweek-nudge-manual for manual sends) as the web version.
// Simplification: the web version's several shadcn <Select> filters
// (range/type/variant) are collapsed into simple toggle-pill rows here -
// same underlying state, fewer UI affordances since this is an internal
// tool.
import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { RefreshCw, Mail, CheckCircle, MousePointer, AlertTriangle, Eye, Send } from "lucide-react-native";
import { supabase } from "../integrations/supabase/client";
import { invokeFunction } from "../lib/supabaseFunctions";
import { colors, radius, spacing } from "../theme/colors";

interface Summary {
  totals: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  };
  breakdown: Array<{
    type: string;
    variantKey: string | null;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    clickRate: number;
  }>;
}

interface RecentEmail {
  sentAt: string;
  type: string;
  variantKey: string | null;
  status: string;
  opened: boolean;
  clicked: boolean;
}

interface Couple {
  id: string;
  user1_name: string;
  user2_name: string;
}

type SendEmailType = "weekly-digest" | "midweek-nudge";

const RANGES = ["7d", "30d", "90d"] as const;
const EMAIL_TYPES = ["all", "digest", "digest-nystart", "midweek-nudge"] as const;

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ icon: Icon, label, value, valueColor }: { icon?: any; label: string; value: string | number; valueColor?: string }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeaderRow}>
        {Icon && <Icon size={14} color={colors.mutedForeground} />}
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function formatPercent(val: number) {
  return `${(val * 100).toFixed(1)}%`;
}

export default function EmailPerformance() {
  const [range, setRange] = useState<string>("30d");
  const [emailType, setEmailType] = useState<string>("all");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<RecentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [selectedCoupleId, setSelectedCoupleId] = useState<string>("all");
  const [sendEmailType, setSendEmailType] = useState<SendEmailType>("weekly-digest");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const headers = { Authorization: `Bearer ${session.access_token}` };

      const summaryRes = await fetch(
        `https://uuijigmwkpmakltymkqe.supabase.co/functions/v1/email-metrics?action=summary&range=${range}&type=${emailType}&variant=all`,
        { headers },
      );
      if (!summaryRes.ok) throw new Error("Failed to fetch summary");
      setSummary(await summaryRes.json());

      const recentRes = await fetch(
        `https://uuijigmwkpmakltymkqe.supabase.co/functions/v1/email-metrics?action=recent&limit=50`,
        { headers },
      );
      if (!recentRes.ok) throw new Error("Failed to fetch recent");
      setRecent(await recentRes.json());
    } catch (error) {
      console.error("Error fetching email metrics:", error);
      Alert.alert("Error", "Failed to load email metrics");
    } finally {
      setLoading(false);
    }
  };

  const fetchCouples = async () => {
    try {
      const { data: couplesData } = await supabase.from("couples").select("id, user1_id, user2_id");
      const userIds = (couplesData || []).flatMap((c) => [c.user1_id, c.user2_id]);
      const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.name || "Unknown"]));
      setCouples(
        (couplesData || []).map((c) => ({
          id: c.id,
          user1_name: profileMap.get(c.user1_id) || "Unknown",
          user2_name: profileMap.get(c.user2_id) || "Unknown",
        })),
      );
    } catch (error) {
      console.error("Error fetching couples:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchCouples();
  }, [range, emailType]);

  const handleSendEmail = async () => {
    try {
      setSendingEmail(true);
      const functionName = sendEmailType === "weekly-digest" ? "send-digest-manual" : "send-midweek-nudge-manual";
      const body = selectedCoupleId !== "all" ? { couple_id: selectedCoupleId } : undefined;
      const { data, error } = await invokeFunction(functionName, { body });
      if (error) throw error;

      const emailLabel = sendEmailType === "weekly-digest" ? "Weekly Digest" : "Mid-week Nudge";
      Alert.alert(
        `${emailLabel} Sent`,
        selectedCoupleId !== "all"
          ? `Successfully sent ${emailLabel.toLowerCase()} to selected couple`
          : `Successfully sent ${data?.successful || data?.sent || 0} ${emailLabel.toLowerCase()} emails`,
      );
      fetchData();
    } catch (error) {
      console.error("Error sending email:", error);
      Alert.alert("Error", `Failed to send ${sendEmailType === "weekly-digest" ? "digest" : "nudge"} emails`);
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading && !summary) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Send email */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Send size={16} color={colors.foreground} />
          <Text style={styles.cardTitle}>Send Email</Text>
        </View>

        <Text style={styles.fieldLabel}>Email Type</Text>
        <View style={styles.pillRow}>
          <Pill label="Weekly Digest" active={sendEmailType === "weekly-digest"} onPress={() => setSendEmailType("weekly-digest")} />
          <Pill label="Mid-week Nudge" active={sendEmailType === "midweek-nudge"} onPress={() => setSendEmailType("midweek-nudge")} />
        </View>

        <Text style={styles.fieldLabel}>Couple (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          <Pill label="All couples" active={selectedCoupleId === "all"} onPress={() => setSelectedCoupleId("all")} />
          {couples.map((c) => (
            <Pill
              key={c.id}
              label={`${c.user1_name} & ${c.user2_name}`}
              active={selectedCoupleId === c.id}
              onPress={() => setSelectedCoupleId(c.id)}
            />
          ))}
        </ScrollView>

        <Pressable style={[styles.primaryButton, sendingEmail && styles.primaryButtonDisabled]} onPress={handleSendEmail} disabled={sendingEmail}>
          {sendingEmail ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {selectedCoupleId !== "all"
                ? `Send ${sendEmailType === "weekly-digest" ? "Digest" : "Nudge"} to Selected`
                : `Send ${sendEmailType === "weekly-digest" ? "Digest" : "Nudge"} to All`}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <View style={styles.pillRow}>
          {RANGES.map((r) => (
            <Pill key={r} label={r} active={range === r} onPress={() => setRange(r)} />
          ))}
        </View>
        <Pressable onPress={fetchData} disabled={loading} style={styles.refreshButton}>
          <RefreshCw size={16} color={colors.foreground} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
        {EMAIL_TYPES.map((t) => (
          <Pill key={t} label={t} active={emailType === t} onPress={() => setEmailType(t)} />
        ))}
      </ScrollView>

      {/* KPIs */}
      {summary && (
        <View style={styles.kpiGrid}>
          <StatCard icon={Mail} label="Sent" value={summary.totals.sent} />
          <StatCard icon={CheckCircle} label="Delivered" value={summary.totals.delivered} />
          <StatCard label="Delivery Rate" value={formatPercent(summary.totals.deliveryRate)} />
          <StatCard icon={Eye} label="Open Rate" value={formatPercent(summary.totals.openRate)} />
          <StatCard icon={MousePointer} label="Click Rate" value={formatPercent(summary.totals.clickRate)} />
          <StatCard label="Bounced" value={summary.totals.bounced} valueColor="#dc2626" />
          <StatCard icon={AlertTriangle} label="Complaints" value={summary.totals.complained} valueColor="#ea580c" />
        </View>
      )}

      {/* Breakdown */}
      {summary && summary.breakdown.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance by Type & Variant</Text>
          {summary.breakdown.map((row, i) => (
            <View key={i} style={styles.breakdownRow}>
              <Text style={styles.breakdownType}>
                {row.type} {row.variantKey ? `(${row.variantKey})` : ""}
              </Text>
              <Text style={styles.breakdownStats}>
                {row.sent} sent · {row.delivered} delivered · {formatPercent(row.clickRate)} click
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Recent */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Emails (Last 50)</Text>
        {recent.map((email, i) => (
          <View key={i} style={styles.recentRow}>
            <View style={styles.recentInfo}>
              <Text style={styles.recentType}>
                {email.type} {email.variantKey ? `(${email.variantKey})` : ""}
              </Text>
              <Text style={styles.recentDate}>{new Date(email.sentAt).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.recentStatus}>{email.status}</Text>
            <Text style={styles.recentMark}>{email.opened ? "👁" : "-"}</Text>
            <Text style={styles.recentMark}>{email.clicked ? "🖱" : "-"}</Text>
          </View>
        ))}
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  pillScroll: {
    marginVertical: spacing.xs,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    color: colors.foreground,
  },
  pillTextActive: {
    color: colors.primaryForeground,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refreshButton: {
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: "center",
  },
  statHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
    marginTop: 2,
  },
  breakdownRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breakdownType: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  breakdownStats: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recentInfo: {
    flex: 1,
  },
  recentType: {
    fontSize: 12,
    color: colors.foreground,
  },
  recentDate: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  recentStatus: {
    fontSize: 11,
    color: colors.mutedForeground,
    width: 70,
  },
  recentMark: {
    fontSize: 12,
    width: 24,
    textAlign: "center",
  },
});
