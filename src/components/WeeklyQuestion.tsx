// "Three things" (BACKLOG.md Ticket 16): one question a week for the couple. Each partner
// writes up to three short answers in private; the partner's answers show up only once
// BOTH have answered. That rule is enforced in the database (see migration 0006), so this
// component only presents what question_state() returns.
//
// The card is mounted by HomeScreen only when the feature flag is on for this user, and it
// renders nothing at all if the server says the feature is off, there is no couple, or the
// state can't be loaded. Nothing here ever logs, tracks or reports answer text.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  AppState,
  StyleSheet,
} from "react-native";
import { Sparkles } from "lucide-react-native";
import { supabase } from "../integrations/supabase/client";
import { invokeFunction } from "../lib/supabaseFunctions";
import { reportError } from "../lib/monitoring";
import { useAnalytics } from "../hooks/useAnalytics";
import { colors, radius, spacing } from "../theme/colors";

const MAX_ANSWER_LENGTH = 140;

interface QuestionState {
  enabled: boolean;
  has_couple?: boolean;
  round_id?: string | null;
  week_start?: string;
  prompt?: { id: string; text: string; category: string };
  my_answers?: string[] | null;
  partner_answered?: boolean;
  revealed?: boolean;
  partner_answers?: string[] | null;
  partner_name?: string | null;
}

interface WeeklyQuestionProps {
  userId: string;
  /** Bump to reload (pull-to-refresh on the home screen). */
  refreshToken: number;
  /** Bump when a notification about this question was tapped: reload, and open the answer sheet if unanswered. */
  focusToken: number;
  onLogMoment: () => void;
}

function AnswerList({ answers }: { answers: string[] }) {
  return (
    <View style={styles.answerList}>
      {answers.map((a, i) => (
        <Text key={i} style={styles.answerText}>
          {i + 1}. {a}
        </Text>
      ))}
    </View>
  );
}

export default function WeeklyQuestion({ userId, refreshToken, focusToken, onLogMoment }: WeeklyQuestionProps) {
  const { track } = useAnalytics();
  const [state, setState] = useState<QuestionState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [drafts, setDrafts] = useState<string[]>(["", "", ""]);
  const [saving, setSaving] = useState(false);
  const tracked = useRef(new Set<string>());

  const load = useCallback(async (): Promise<QuestionState | null> => {
    const { data, error } = await supabase.rpc("question_state");
    if (error) {
      // Keep whatever we last showed; just report real server problems.
      reportError(error, { flow: "question_state" });
      return null;
    }
    const next = data as unknown as QuestionState;
    setState(next);
    return next;
  }, []);

  const openAnswer = (s: QuestionState) => {
    const existing = s.my_answers ?? [];
    setDrafts([existing[0] ?? "", existing[1] ?? "", existing[2] ?? ""]);
    setModalOpen(true);
  };

  useEffect(() => {
    load();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") load();
    });
    return () => subscription.remove();
  }, [load]);

  useEffect(() => {
    if (refreshToken > 0) load();
  }, [refreshToken, load]);

  useEffect(() => {
    if (focusToken === 0) return;
    load().then((next) => {
      if (next?.enabled && next.round_id && !next.my_answers) openAnswer(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  // Measurement: counts only, once per round per app session. No answer text, ever.
  useEffect(() => {
    if (!state?.enabled || !state.round_id) return;
    const viewedKey = `viewed:${state.round_id}`;
    if (!tracked.current.has(viewedKey)) {
      tracked.current.add(viewedKey);
      track("question_viewed", { answered: !!state.my_answers });
    }
    const revealedKey = `revealed:${state.round_id}`;
    if (state.revealed && !tracked.current.has(revealedKey)) {
      tracked.current.add(revealedKey);
      track("question_revealed", {});
    }
  }, [state?.enabled, state?.round_id, state?.revealed, state?.my_answers, track]);

  const save = async () => {
    const answers = drafts.map((d) => d.trim()).filter((d) => d.length > 0);
    if (!state?.round_id || answers.length === 0 || saving) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("submit_answers", { p_round_id: state.round_id, p_answers: answers });
    setSaving(false);

    if (error) {
      const message = error.message ?? "";
      if (message.includes("already_revealed")) {
        Alert.alert("Answers are locked", "You've both answered, so answers can't be changed any more.");
      } else if (message.includes("round_closed")) {
        Alert.alert("This question has closed", "A new question arrives on Monday.");
      } else if (!message.includes("feature_disabled")) {
        reportError(error, { flow: "submit_answers" });
        Alert.alert("Couldn't save", "Please try again.");
        return;
      }
      setModalOpen(false);
      await load();
      return;
    }

    const result = data as unknown as { first_submit?: boolean; revealed?: boolean } | null;
    setModalOpen(false);
    track("question_answered", { first_submit: !!result?.first_submit, revealed: !!result?.revealed });
    await load();

    // Tell the partner once, on the first save only. The function re-checks everything itself.
    if (result?.first_submit) {
      invokeFunction("notify-partner-answered", { body: { round_id: state.round_id } }).catch(() => {});
    }
  };

  const confirmDelete = () => {
    const roundId = state?.round_id;
    if (!roundId) return;
    Alert.alert(
      "Delete your answer?",
      state?.revealed
        ? "Your partner's answers will be hidden again until you answer. This can't be undone."
        : "This removes your answer. You can write a new one any time this week.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("prompt_answers").delete().eq("round_id", roundId).eq("user_id", userId);
            if (error) {
              reportError(error, { flow: "delete_answer" });
              Alert.alert("Couldn't delete", "Please try again.");
              return;
            }
            await load();
          },
        },
      ],
    );
  };

  if (!state || !state.enabled || !state.has_couple || !state.round_id || !state.prompt) return null;

  const mine = state.my_answers ?? null;
  const theirs = state.partner_answers ?? null;
  const partnerLabel = state.partner_name || "Your partner";
  const canSave = drafts.some((d) => d.trim().length > 0) && !saving;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Sparkles size={16} color={colors.primary} />
        <Text style={styles.label}>THIS WEEK'S QUESTION</Text>
      </View>
      <Text style={styles.question}>{state.prompt.text}</Text>

      {!mine && (
        <>
          {state.partner_answered && (
            <Text style={styles.caption}>{partnerLabel} has answered. Add yours to see theirs.</Text>
          )}
          <Pressable style={styles.primaryButton} onPress={() => openAnswer(state)}>
            <Text style={styles.primaryButtonText}>Answer</Text>
          </Pressable>
          {!state.partner_answered && (
            <Text style={styles.caption}>Answers stay private until you've both answered. Skipping is fine too.</Text>
          )}
        </>
      )}

      {mine && !state.revealed && (
        <>
          <Text style={styles.waitingTitle}>Waiting for {state.partner_name || "your partner"}</Text>
          <AnswerList answers={mine} />
          <View style={styles.buttonRow}>
            <Pressable style={styles.outlineButton} onPress={() => openAnswer(state)}>
              <Text style={styles.outlineButtonText}>Edit</Text>
            </Pressable>
          </View>
          <Pressable onPress={confirmDelete} style={styles.linkButton}>
            <Text style={styles.linkText}>Delete my answer</Text>
          </Pressable>
        </>
      )}

      {mine && state.revealed && theirs && (
        <>
          <View style={styles.columns}>
            <View style={styles.column}>
              <Text style={styles.columnTitle}>You</Text>
              <AnswerList answers={mine} />
            </View>
            <View style={styles.column}>
              <Text style={styles.columnTitle}>{state.partner_name || "Partner"}</Text>
              <AnswerList answers={theirs} />
            </View>
          </View>
          <Pressable style={styles.outlineButton} onPress={onLogMoment}>
            <Text style={styles.outlineButtonText}>Log a moment</Text>
          </Pressable>
          <Pressable onPress={confirmDelete} style={styles.linkButton}>
            <Text style={styles.linkText}>Delete my answer</Text>
          </Pressable>
        </>
      )}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => !saving && setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.overlay} onPress={() => !saving && setModalOpen(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetQuestion}>{state.prompt.text}</Text>
              <Text style={styles.caption}>
                Short is perfect. Only your partner sees these, and only once you've both answered.
              </Text>
              {drafts.map((value, i) => (
                <View key={i}>
                  <TextInput
                    value={value}
                    onChangeText={(t) => setDrafts((prev) => prev.map((p, j) => (j === i ? t : p)))}
                    placeholder={`${i + 1}.`}
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={MAX_ANSWER_LENGTH}
                    multiline
                    editable={!saving}
                    style={styles.input}
                  />
                  {value.length >= 100 && (
                    <Text style={styles.counter}>
                      {value.length}/{MAX_ANSWER_LENGTH}
                    </Text>
                  )}
                </View>
              ))}
              <View style={styles.sheetActions}>
                <Pressable onPress={() => setModalOpen(false)} disabled={saving} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={save} disabled={!canSave} style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}>
                  {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.saveText}>Save</Text>}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary + "33",
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, color: colors.primary },
  question: { fontSize: 17, fontWeight: "700", color: colors.foreground },
  caption: { fontSize: 12, color: colors.mutedForeground },
  waitingTitle: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  answerList: { gap: spacing.xs },
  answerText: { fontSize: 14, color: colors.foreground },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  columns: { flexDirection: "row", gap: spacing.sm },
  column: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  columnTitle: { fontSize: 12, fontWeight: "700", color: colors.mutedForeground },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.primaryForeground, fontWeight: "600" },
  outlineButton: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  outlineButtonText: { color: colors.foreground, fontWeight: "600" },
  linkButton: { alignItems: "center", paddingVertical: spacing.xs },
  linkText: { fontSize: 13, color: colors.mutedForeground },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  sheetQuestion: { fontSize: 17, fontWeight: "700", color: colors.foreground },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    color: colors.foreground,
    textAlignVertical: "top",
  },
  counter: { fontSize: 11, color: colors.mutedForeground, textAlign: "right", marginTop: 2 },
  sheetActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  cancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  cancelText: { color: colors.mutedForeground, fontSize: 16 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minWidth: 96,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: colors.primaryForeground, fontSize: 16, fontWeight: "700" },
});
