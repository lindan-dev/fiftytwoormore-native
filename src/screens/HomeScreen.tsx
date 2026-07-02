// Ported from src/pages/Index.tsx - the real single-page dashboard, not a
// simple activity list. Structure: header (name/badges/icons) -> partner
// summary card OR code-based connect card -> year-in-review CTA -> compact
// stats -> year goal tracker -> Log Now button -> Log/Stats/Admin toggle
// -> content area (Calendar for "log", full Stats for "stats", admin
// tools for "admin") -> footer.
//
// Correction from an earlier pass: the web app's actual invitation
// mechanism is an 8-character code generated from the invitation row's
// UUID (couple_invitations.id.substring(0,8)), not the email-based
// InvitationFlow.tsx component (which turned out to be dead code, never
// rendered anywhere in the web app).
import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  RefreshControl,
  Linking,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as Application from "expo-application";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Heart,
  Info,
  User,
  LogOut,
  Copy,
  Plus,
  List,
  BarChart3,
  Shield,
  Sparkles,
  TrendingUp,
  FlaskConical,
  Bell,
} from "lucide-react-native";
import { supabase } from "../integrations/supabase/client";
import { registerForPushNotificationsAsync } from "../lib/pushNotifications";
import { useAnalytics } from "../hooks/useAnalytics";
import EmojiSelector from "../components/EmojiSelector";
import LocationPicker, { LocationValue } from "../components/LocationPicker";
import CalendarView from "../components/CalendarView";
import StatsView from "../components/StatsView";
import YearGoalTracker from "../components/YearGoalTracker";
import FunnelAnalytics from "../components/FunnelAnalytics";
import EmailPerformance from "../components/EmailPerformance";
import TestUserManager from "../components/TestUserManager";
import PushNotificationTester from "../components/PushNotificationTester";
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

function getCohortKeyFromAnniversary(anniversary: string): string {
  const anniversaryDate = new Date(anniversary);
  const yearsTogether = (Date.now() - anniversaryDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (yearsTogether < 1) return "rel_0-1";
  if (yearsTogether < 3) return "rel_1-3";
  if (yearsTogether < 7) return "rel_3-7";
  if (yearsTogether < 15) return "rel_7-15";
  return "rel_15+";
}

type ViewMode = "log" | "stats" | "admin";
type AdminTab = "funnel" | "email" | "users" | "push";

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { track } = useAnalytics();

  const [userId, setUserId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [checkingPartner, setCheckingPartner] = useState(true);
  const [hasPartner, setHasPartner] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [connectedDate, setConnectedDate] = useState("");
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isBetaUser, setIsBetaUser] = useState(false);
  const [benchmarkOptIn, setBenchmarkOptIn] = useState(false);
  const [anniversary, setAnniversary] = useState<string | null>(null);
  const [cohortData, setCohortData] = useState<any>(null);

  const [myInvitationCode, setMyInvitationCode] = useState<string | null>(null);
  const [enterCode, setEnterCode] = useState("");
  const [sendingInvitation, setSendingInvitation] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [customDateTime, setCustomDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [selectedNotes, setSelectedNotes] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationValue | null>(null);

  const [view, setView] = useState<ViewMode>("log");
  const [adminTab, setAdminTab] = useState<AdminTab>("funnel");

  const fetchActivities = useCallback(async (uid: string) => {
    const { data: partnerId } = await supabase.rpc("get_partner_id", { user_id: uid });
    const userIds = partnerId ? [uid, partnerId] : [uid];
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .in("user_id", userIds)
      .order("activity_date", { ascending: false });
    if (!error) setActivities(data || []);
  }, []);

  const checkInvitations = useCallback(async (uid: string) => {
    const { data: myInvite } = await supabase
      .from("couple_invitations")
      .select("*")
      .eq("sender_id", uid)
      .eq("status", "pending")
      .maybeSingle();
    if (myInvite) setMyInvitationCode(myInvite.id.substring(0, 8).toUpperCase());
  }, []);

  const checkPartnerStatus = useCallback(
    async (uid: string) => {
      setCheckingPartner(true);
      const { data, error } = await supabase
        .from("couples")
        .select("*")
        .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
        .maybeSingle();

      if (error || !data) {
        setHasPartner(false);
        setPartnerName("");
        setConnectedDate("");
        checkInvitations(uid);
        setCheckingPartner(false);
        return;
      }

      setHasPartner(true);
      setConnectedDate(data.created_at);
      setAnniversary(data.anniversary || null);

      const partnerId = data.user1_id === uid ? data.user2_id : data.user1_id;
      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("name, is_beta_user")
        .eq("user_id", partnerId)
        .maybeSingle();
      if (partnerProfile) setPartnerName(partnerProfile.name || "Your Partner");

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("is_beta_user, benchmark_opt_in")
        .eq("user_id", uid)
        .maybeSingle();
      if (myProfile?.is_beta_user) setIsBetaUser(true);
      setBenchmarkOptIn(myProfile?.benchmark_opt_in || false);

      if (myProfile?.benchmark_opt_in && data.anniversary) {
        const cohortKey = getCohortKeyFromAnniversary(data.anniversary);
        const currentPeriod = new Date().toISOString().slice(0, 7);
        const { data: cohort } = await supabase
          .from("benchmark_cohorts")
          .select("*")
          .eq("cohort_key", cohortKey)
          .eq("period_type", "month")
          .eq("period", currentPeriod)
          .maybeSingle();
        setCohortData(cohort);
      }

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "superuser")
        .maybeSingle();
      setIsSuperuser(!!userRole);

      await fetchActivities(uid);
      setCheckingPartner(false);
    },
    [checkInvitations, fetchActivities],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (uid) {
        setUserId(uid);
        checkPartnerStatus(uid);
        registerForPushNotificationsAsync(uid);
      }
    });
  }, [checkPartnerStatus]);

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    await checkPartnerStatus(userId);
    setRefreshing(false);
  };

  const generateInvitationCode = async () => {
    if (!userId) return;
    setSendingInvitation(true);
    try {
      const { data, error } = await supabase
        .from("couple_invitations")
        .insert([{ sender_id: userId, receiver_email: "" }])
        .select()
        .single();
      if (error) throw error;
      setMyInvitationCode(data.id.substring(0, 8).toUpperCase());
      track("invitation_code_generated");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSendingInvitation(false);
    }
  };

  const copyInvitationCode = async () => {
    if (myInvitationCode) {
      await Clipboard.setStringAsync(myInvitationCode);
      track("invitation_code_shared");
      Alert.alert("Copied!", "Invitation code copied to clipboard.");
    }
  };

  const handleConnectWithCode = async () => {
    if (!enterCode || !userId) {
      Alert.alert("Error", "Please enter an invitation code");
      return;
    }
    setSendingInvitation(true);
    try {
      const { data, error: validateError } = await supabase.functions.invoke("validate-invitation-code", {
        body: { code: enterCode },
      });
      if (validateError || !data?.success) {
        Alert.alert("Invalid code", data?.error || "This invitation code doesn't exist or has expired.");
        return;
      }

      const matchingInvite = data.invitation;
      const { error: updateError } = await supabase
        .from("couple_invitations")
        .update({ status: "accepted" })
        .eq("id", matchingInvite.id);
      if (updateError) throw updateError;

      const ids = [matchingInvite.sender_id, userId].sort();
      const { error: coupleError } = await supabase.from("couples").insert([{ user1_id: ids[0], user2_id: ids[1] }]);
      if (coupleError) throw coupleError;

      // Push notification to both parties. This replaces the old
      // notify-partner-connected email, which turned out to never fire in
      // the real (code-based) connect flow - see BACKLOG.md Ticket 2.
      // Best-effort: a failure here shouldn't block the connection itself.
      try {
        await supabase.functions.invoke("notify-partner-connected-push", {
          body: { partner_id: matchingInvite.sender_id },
        });
      } catch (pushError) {
        console.error("Error sending partner-connected push:", pushError);
      }

      track("couple_formed");
      track("invitation_code_entered", { valid: true });
      Alert.alert("Connected!", "You and your partner are now connected.");
      checkPartnerStatus(userId);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setSendingInvitation(false);
    }
  };

  const handleLogActivity = async (activityDate: Date, emoji: string, notes?: string, location?: LocationValue | null) => {
    if (!userId) return;
    const { error } = await supabase.from("activities").insert([
      {
        user_id: userId,
        activity_date: activityDate.toISOString(),
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
      track(isFirstActivity ? "first_activity_logged" : "activity_logged", { has_partner: hasPartner, emoji: emoji || "" });
      fetchActivities(userId);
      setDialogOpen(false);
      setSelectedEmoji("");
      setSelectedNotes("");
      setSelectedLocation(null);
    }
  };

  const handleCustomLog = () => {
    if (!selectedEmoji) {
      Alert.alert("Error", "Please select an emoji");
      return;
    }
    handleLogActivity(customDateTime, selectedEmoji, selectedNotes, selectedLocation);
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
    if (error) Alert.alert("Error", "Failed to update activity");
    else if (userId) fetchActivities(userId);
  };

  const handleDeleteActivity = async (id: string) => {
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) Alert.alert("Error", "Failed to delete activity");
    else if (userId) fetchActivities(userId);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const openLogDialog = () => {
    const now = new Date();
    setCustomDateTime(now);
    setSelectedEmoji("");
    setSelectedNotes("");
    const latestWithLoc = activities.find((a) => a.location_label);
    setSelectedLocation(
      latestWithLoc?.location_label
        ? {
            label: latestWithLoc.location_label,
            country: latestWithLoc.location_country ?? null,
            lat: latestWithLoc.location_lat ?? null,
            lng: latestWithLoc.location_lng ?? null,
          }
        : null,
    );
    setDialogOpen(true);
  };

  // Deep-link handling: when a push notification is tapped, pushNotifications.ts
  // navigates here with an `action` param (see send-weekly-digest-push,
  // send-midweek-nudge-push, send-activation-nudge-push). React to it once,
  // then clear it so re-focusing this screen later doesn't repeat the action.
  useEffect(() => {
    const action = route.params?.action;
    if (!action) return;

    if (action === "openStats") {
      setView("stats");
    } else if (action === "openLogDialog") {
      openLogDialog();
    }

    navigation.setParams({ action: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.action]);

  if (checkingPartner) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Heart size={48} color={colors.primary} />
      </SafeAreaView>
    );
  }

  const previousYear = new Date().getFullYear() - 1;
  const isWithinFirstTwoWeeks = new Date().getMonth() === 0 && new Date().getDate() <= 14;
  const hasPreviousYearData = activities.some((a) => new Date(a.activity_date).getFullYear() === previousYear);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Heart size={18} color="#fff" fill="#fff" />
          </View>
          <Text style={styles.headerTitle}>fiftytwoormore</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerButton} onPress={() => navigation.navigate("Onboarding")}>
            <Info size={20} color="#fff" />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={() => navigation.navigate("Profile")}>
            <User size={20} color="#fff" />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={handleSignOut}>
            <LogOut size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {hasPartner ? (
          <>
            <View style={styles.card}>
              <View style={styles.partnerRow}>
                <View style={styles.avatarLarge}>
                  <Heart size={22} color="#fff" fill="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerText}>
                    Doing it with <Text style={styles.bold}>{partnerName}</Text> since{" "}
                    {activities.length > 0
                      ? new Date(activities[activities.length - 1].activity_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : connectedDate
                      ? new Date(connectedDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                      : ""}
                  </Text>
                  <Text style={styles.mutedSmall}>
                    {activities.length} {activities.length === 1 ? "activity" : "activities"} and counting 🔥
                  </Text>
                </View>
              </View>
            </View>

            {hasPreviousYearData && isWithinFirstTwoWeeks && (
              <Pressable style={styles.yirCard} onPress={() => navigation.navigate("YearInReview", { year: previousYear })}>
                <View style={styles.avatarMedium}>
                  <Sparkles size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.yirTitle}>Your {previousYear} Year in Review</Text>
                  <Text style={styles.mutedSmall}>Relive your highlights, streaks & favourite ways to connect ✨</Text>
                </View>
              </Pressable>
            )}

            {activities.length > 0 && (
              <>
                <StatsView activities={activities} compact />
                <YearGoalTracker activities={activities} />
              </>
            )}
          </>
        ) : (
          <View style={styles.card}>
            <View style={styles.partnerRow}>
              <View style={styles.avatarLarge}>
                <Heart size={18} color="#fff" fill="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Connect with Your Partner</Text>
                <Text style={styles.mutedSmall}>Share your code or enter partner's code</Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Your Invitation Code</Text>
            {myInvitationCode ? (
              <View style={styles.codeRow}>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{myInvitationCode}</Text>
                </View>
                <Pressable style={styles.iconOutlineButton} onPress={copyInvitationCode}>
                  <Copy size={18} color={colors.foreground} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.primaryButton} onPress={generateInvitationCode} disabled={sendingInvitation}>
                {sendingInvitation ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryButtonText}>Generate Code</Text>}
              </Pressable>
            )}
            {myInvitationCode && <Text style={styles.captionText}>Share this code with your partner via WhatsApp, SMS, or any messaging app</Text>}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.fieldLabel}>Enter Partner's Code</Text>
            <View style={styles.codeRow}>
              <TextInput
                value={enterCode}
                onChangeText={(t) => setEnterCode(t.toUpperCase())}
                placeholder="ABC12345"
                maxLength={8}
                autoCapitalize="characters"
                editable={!sendingInvitation}
                style={[styles.input, styles.codeInput]}
                placeholderTextColor={colors.mutedForeground}
              />
              <Pressable
                style={[styles.primaryButton, styles.connectButton, (sendingInvitation || enterCode.length < 8) && styles.primaryButtonDisabled]}
                onPress={handleConnectWithCode}
                disabled={sendingInvitation || !enterCode || enterCode.length < 8}
              >
                {sendingInvitation ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryButtonText}>Connect</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {!hasPartner && (
          <View style={styles.hintCard}>
            <Text style={styles.cardTitle}>Waiting for partner, but you can start already.</Text>
            <Text style={styles.mutedSmall}>
              fiftytwoormore is best used together with your partner, but you can start on your own right away. Log your first moment by
              tapping "Log Now" below.
            </Text>
          </View>
        )}

        <Pressable style={styles.logNowButton} onPress={openLogDialog}>
          <Plus size={20} color={colors.primaryForeground} />
          <Text style={styles.logNowText}>Log Now</Text>
        </Pressable>

        {/* View toggle */}
        <View style={styles.toggleRow}>
          <Pressable style={[styles.toggleButton, view === "log" && styles.toggleButtonActive]} onPress={() => setView("log")}>
            <List size={16} color={view === "log" ? colors.primaryForeground : colors.foreground} />
            <Text style={[styles.toggleText, view === "log" && styles.toggleTextActive]}>Log</Text>
          </Pressable>
          <Pressable style={[styles.toggleButton, view === "stats" && styles.toggleButtonActive]} onPress={() => setView("stats")}>
            <BarChart3 size={16} color={view === "stats" ? colors.primaryForeground : colors.foreground} />
            <Text style={[styles.toggleText, view === "stats" && styles.toggleTextActive]}>Stats</Text>
          </Pressable>
          {isSuperuser && (
            <Pressable style={[styles.toggleButton, view === "admin" && styles.toggleButtonActive]} onPress={() => setView("admin")}>
              <Shield size={16} color={view === "admin" ? colors.primaryForeground : colors.foreground} />
              <Text style={[styles.toggleText, view === "admin" && styles.toggleTextActive]}>Admin</Text>
            </Pressable>
          )}
        </View>

        {/* Content area */}
        {view === "log" && (
          <CalendarView activities={activities} currentUserId={userId ?? undefined} onDelete={handleDeleteActivity} onUpdate={handleUpdateActivity} />
        )}
        {view === "stats" && (
          <StatsView
            activities={activities}
            benchmarkOptIn={benchmarkOptIn}
            anniversary={anniversary}
            cohortData={cohortData}
            onViewYearInReview={(year) => navigation.navigate("YearInReview", { year })}
          />
        )}
        {view === "admin" && isSuperuser && (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.adminVersionText}>
              Version {Application.nativeApplicationVersion} (build {Application.nativeBuildVersion})
            </Text>
            <View style={styles.adminTabRow}>
              <Pressable style={[styles.adminTab, adminTab === "funnel" && styles.adminTabActive]} onPress={() => setAdminTab("funnel")}>
                <TrendingUp size={14} color={adminTab === "funnel" ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.adminTabText, adminTab === "funnel" && styles.adminTabTextActive]}>Funnel</Text>
              </Pressable>
              <Pressable style={[styles.adminTab, adminTab === "email" && styles.adminTabActive]} onPress={() => setAdminTab("email")}>
                <BarChart3 size={14} color={adminTab === "email" ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.adminTabText, adminTab === "email" && styles.adminTabTextActive]}>Email</Text>
              </Pressable>
              <Pressable style={[styles.adminTab, adminTab === "users" && styles.adminTabActive]} onPress={() => setAdminTab("users")}>
                <FlaskConical size={14} color={adminTab === "users" ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.adminTabText, adminTab === "users" && styles.adminTabTextActive]}>Users</Text>
              </Pressable>
              <Pressable style={[styles.adminTab, adminTab === "push" && styles.adminTabActive]} onPress={() => setAdminTab("push")}>
                <Bell size={14} color={adminTab === "push" ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.adminTabText, adminTab === "push" && styles.adminTabTextActive]}>Push</Text>
              </Pressable>
            </View>
            {adminTab === "funnel" && <FunnelAnalytics />}
            {adminTab === "email" && <EmailPerformance />}
            {adminTab === "users" && <TestUserManager />}
            {adminTab === "push" && <PushNotificationTester />}
          </View>
        )}

        {/* Support link */}
        <Pressable
          style={styles.supportLink}
          onPress={() => Linking.openURL("https://buy.stripe.com/14AbJ34zR6ofcci1fJ5EY00")}
        >
          <Heart size={14} color={colors.mutedForeground} fill={colors.mutedForeground} />
          <Text style={styles.supportLinkText}>Support our project - cheaper than therapy</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} Lindan AB. All rights reserved.</Text>
          <Pressable onPress={() => Linking.openURL("mailto:fiftytwoormore@lindaninc.com")}>
            <Text style={[styles.footerText, styles.footerLink]}>Contact: fiftytwoormore@lindaninc.com</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Log activity modal */}
      <Modal visible={dialogOpen} animationType="slide" onRequestClose={() => setDialogOpen(false)}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>Log Activity</Text>

          <Text style={styles.fieldLabel}>Date & Time</Text>
          <View style={styles.dateTimeRow}>
            <Pressable style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateTimeText}>{customDateTime.toLocaleDateString()}</Text>
            </Pressable>
            <Pressable style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.dateTimeText}>{customDateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            </Pressable>
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={customDateTime}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, selected) => {
                setShowDatePicker(false);
                if (selected) {
                  const merged = new Date(customDateTime);
                  merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                  setCustomDateTime(merged);
                }
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={customDateTime}
              mode="time"
              onChange={(_, selected) => {
                setShowTimePicker(false);
                if (selected) {
                  const merged = new Date(customDateTime);
                  merged.setHours(selected.getHours(), selected.getMinutes());
                  setCustomDateTime(merged);
                }
              }}
            />
          )}

          <Text style={styles.fieldLabel}>Activity Type</Text>
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
            style={[styles.primaryButton, !selectedEmoji && styles.primaryButtonDisabled]}
            onPress={handleCustomLog}
            disabled={!selectedEmoji}
          >
            <Text style={styles.primaryButtonText}>Log Activity</Text>
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
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff33",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary + "33",
    padding: spacing.md,
    gap: spacing.sm,
  },
  partnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatarLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMedium: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  partnerText: {
    fontSize: 14,
    color: colors.foreground,
  },
  bold: {
    fontWeight: "700",
  },
  mutedSmall: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  yirCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary + "0d",
    borderWidth: 2,
    borderColor: colors.primary + "33",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  yirTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.foreground,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.foreground,
  },
  codeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  codeBox: {
    flex: 1,
    backgroundColor: colors.primary + "0d",
    borderWidth: 2,
    borderColor: colors.primary + "33",
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  codeText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 2,
  },
  iconOutlineButton: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  captionText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.primary + "33",
  },
  dividerText: {
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.foreground,
  },
  codeInput: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    letterSpacing: 2,
  },
  connectButton: {
    width: 110,
  },
  hintCard: {
    backgroundColor: colors.primary + "0d",
    borderWidth: 2,
    borderColor: colors.primary + "1a",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  logNowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
  },
  logNowText: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.primary + "1a",
    borderRadius: radius.md,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 13,
    color: colors.foreground,
  },
  toggleTextActive: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  adminVersionText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  adminTabRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  adminTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.muted,
  },
  adminTabActive: {
    backgroundColor: colors.primary + "1a",
  },
  adminTabText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  adminTabTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  supportLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  supportLinkText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  footer: {
    alignItems: "center",
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  footerLink: {
    textDecorationLine: "underline",
    marginTop: 2,
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
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
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
