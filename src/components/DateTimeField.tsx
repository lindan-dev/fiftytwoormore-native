// Replaces the earlier `display="compact"` DateTimePicker approach, which
// turned out to render unreliably when nested inside a ScrollView: tapping
// it produced a disconnected floating pill instead of a proper popover,
// and in testing the date silently changed to a value the user never
// selected (see screen recording from 2026-07-07). `display="compact"`'s
// popover apparently doesn't anchor correctly in that context.
//
// This sidesteps the whole problem: our own pill buttons open our own
// Modal (a separate top-level presentation layer, immune to ScrollView
// positioning quirks) containing a plain `display="spinner"` picker with
// explicit Cancel/Done buttons - reliable, and clearer than "compact"'s
// implicit auto-apply-on-dismiss behavior.
import { useState } from "react";
import { View, Text, Pressable, Modal, Platform, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors, radius, spacing } from "../theme/colors";

interface DateTimeFieldProps {
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
}

type ActiveField = "date" | "time" | null;

export default function DateTimeField({ value, onChange, maximumDate }: DateTimeFieldProps) {
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [tempValue, setTempValue] = useState(value);

  const open = (field: "date" | "time") => {
    setTempValue(value);
    setActiveField(field);
  };

  const confirm = () => {
    const merged = new Date(value);
    if (activeField === "date") {
      merged.setFullYear(tempValue.getFullYear(), tempValue.getMonth(), tempValue.getDate());
    } else if (activeField === "time") {
      merged.setHours(tempValue.getHours(), tempValue.getMinutes());
    }
    onChange(merged);
    setActiveField(null);
  };

  return (
    <>
      <View style={styles.row}>
        <Pressable style={styles.pill} onPress={() => open("date")}>
          <Text style={styles.pillText}>{value.toLocaleDateString()}</Text>
        </Pressable>
        <Pressable style={styles.pill} onPress={() => open("time")}>
          <Text style={styles.pillText}>{value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
        </Pressable>
      </View>

      <Modal visible={activeField !== null} transparent animationType="fade" onRequestClose={() => setActiveField(null)}>
        <Pressable style={styles.overlay} onPress={() => setActiveField(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {activeField && (
              <DateTimePicker
                value={tempValue}
                mode={activeField}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={activeField === "date" ? maximumDate : undefined}
                onChange={(_, selected) => {
                  if (selected) setTempValue(selected);
                }}
              />
            )}
            <View style={styles.actions}>
              <Pressable onPress={() => setActiveField(null)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirm} style={styles.doneBtn}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  pillText: {
    color: colors.foreground,
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cancelText: {
    color: colors.mutedForeground,
    fontSize: 16,
  },
  doneBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  doneText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
});
