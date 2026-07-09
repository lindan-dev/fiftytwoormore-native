// Simple admin tool to verify the push notification pipeline end to end:
// device token registration -> push_tokens table -> send-push-notification
// edge function -> Expo push service -> device. Not a feature for end
// users, just a diagnostic for us while building this out.
import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { supabase } from "../integrations/supabase/client";
import { invokeFunction } from "../lib/supabaseFunctions";
import { colors, radius, spacing } from "../theme/colors";

export default function PushNotificationTester() {
  const [title, setTitle] = useState("Test notification");
  const [body, setBody] = useState("If you see this, the pipeline works! 🎉");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const sendToSelf = async () => {
    setSending(true);
    setLastResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data, error } = await invokeFunction("send-push-notification", {
        body: { user_ids: [user.id], title, body },
      });

      if (error) throw error;

      if (data?.sent === 0) {
        setLastResult("No push token found for your account yet. Make sure you granted notification permission and are running a development build or TestFlight build (not Expo Go).");
      } else {
        setLastResult(`Sent to ${data?.sent ?? 0} device(s). Check your phone.`);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
      setLastResult(`Failed: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  // The four scheduled/triggered push types, still manually invoked for
  // now (see BACKLOG.md Ticket 2 - actual cron cadence is an open
  // decision). Scoped to the current (superuser) account only via
  // user_ids, so testing never sends real notifications to real couples.
  const testTrigger = async (
    label: string,
    functionName: string,
    extraBody: Record<string, unknown> = {},
  ) => {
    setSending(true);
    setLastResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data, error } = await invokeFunction(functionName, {
        body: { user_ids: [user.id], ...extraBody },
      });
      if (error) throw error;

      setLastResult(`${label}: ${JSON.stringify(data)}`);
    } catch (error: any) {
      Alert.alert("Error", error.message);
      setLastResult(`${label} failed: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Send Test Push Notification</Text>
        <Text style={styles.description}>
          Sends a push notification to your own registered device(s). Requires a development build or
          TestFlight build - this will not work in Expo Go or a plain simulator run.
        </Text>

        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor={colors.mutedForeground} />

        <Text style={styles.fieldLabel}>Body</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          style={styles.input}
          multiline
          placeholderTextColor={colors.mutedForeground}
        />

        <Pressable style={[styles.button, sending && styles.buttonDisabled]} onPress={sendToSelf} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.buttonText}>Send to myself</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Test Scheduled Push Triggers</Text>
        <Text style={styles.description}>
          These are the same push types planned to eventually replace weekly digest, midweek nudge,
          activation, and year-in-review emails. Not yet on a real schedule - manual trigger only, scoped
          to your own account so testing never reaches real couples.
        </Text>

        <Pressable
          style={[styles.button, styles.secondaryButton, sending && styles.buttonDisabled]}
          onPress={() => testTrigger("Weekly digest", "send-weekly-digest-push", { force: true })}
          disabled={sending}
        >
          <Text style={styles.secondaryButtonText}>Weekly digest push</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondaryButton, sending && styles.buttonDisabled]}
          onPress={() => testTrigger("Midweek nudge", "send-midweek-nudge-push", { force: true })}
          disabled={sending}
        >
          <Text style={styles.secondaryButtonText}>Midweek nudge push</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondaryButton, sending && styles.buttonDisabled]}
          onPress={() => testTrigger("Activation nudge", "send-activation-nudge-push", { max_days_since_signup: 3650 })}
          disabled={sending}
        >
          <Text style={styles.secondaryButtonText}>Activation nudge push</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondaryButton, sending && styles.buttonDisabled]}
          onPress={() => testTrigger("Year in review", "send-yearly-review-push")}
          disabled={sending}
        >
          <Text style={styles.secondaryButtonText}>Year in review push</Text>
        </Pressable>

        {lastResult && <Text style={styles.resultText}>{lastResult}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },
  description: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  secondaryButtonText: {
    color: colors.foreground,
    fontWeight: "600",
  },
  resultText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
});
