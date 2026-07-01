// Ported from src/components/PeriodPicker.tsx. shadcn Select (web dropdown)
// has no direct RN equivalent, so this uses a Pressable that opens a
// lightweight Modal list - same options, same labels, same behavior.
import { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { ChevronDown, Check } from "lucide-react-native";
import { colors, radius, spacing } from "../theme/colors";

export type PeriodOption = "this-month" | "last-8-weeks" | "this-year" | "all-time";
export type ComparisonOption = "previous-period" | "same-period-last-year" | "all-time-average";

interface PeriodPickerProps {
  period: PeriodOption;
  comparison: ComparisonOption;
  onPeriodChange: (period: PeriodOption) => void;
  onComparisonChange: (comparison: ComparisonOption) => void;
}

export const periodLabels: Record<PeriodOption, string> = {
  "this-month": "This month",
  "last-8-weeks": "Last 8 weeks",
  "this-year": "This year",
  "all-time": "All time",
};

export const comparisonLabels: Record<ComparisonOption, string> = {
  "previous-period": "vs Previous period",
  "same-period-last-year": "vs Last year",
  "all-time-average": "vs All time avg",
};

function PickerButton<T extends string>({
  value,
  labels,
  onChange,
}: {
  value: T;
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = Object.keys(labels) as T[];

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText}>{labels[value]}</Text>
        <ChevronDown size={14} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {options.map((opt) => (
              <Pressable
                key={opt}
                style={styles.option}
                onPress={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                <Text style={styles.optionText}>{labels[opt]}</Text>
                {opt === value && <Check size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function PeriodPicker({
  period,
  comparison,
  onPeriodChange,
  onComparisonChange,
}: PeriodPickerProps) {
  return (
    <View style={styles.row}>
      <PickerButton value={period} labels={periodLabels} onChange={onPeriodChange} />
      <PickerButton value={comparison} labels={comparisonLabels} onChange={onComparisonChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  triggerText: {
    fontSize: 12,
    color: colors.foreground,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xl,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionText: {
    fontSize: 15,
    color: colors.foreground,
  },
});
