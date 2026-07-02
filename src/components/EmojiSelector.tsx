// Ported from src/components/EmojiSelector.tsx.
// shadcn Card/Button -> View/Pressable + StyleSheet. Grid uses flexWrap
// instead of CSS grid (RN has no grid layout).
//
// Fixed 5x3 grid with its own internal ScrollView: with ~79 emoji
// presets, letting this grow to full height forces the whole create/edit
// dialog to scroll just to reach the save button. Containing the scroll
// here keeps the rest of the form (date, notes, location, save) reachable
// without scrolling.
//
// Rows are chunked manually into groups of 5 with percentage-width
// buttons, rather than relying on flexWrap + a measured/guessed pixel
// size. Two earlier approaches (guessed screen-width math, then
// onLayout measurement) both produced only 4 columns with leftover
// whitespace - percentage widths resolved directly by the layout engine
// sidestep whatever timing/measurement issue caused that.
import { useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { getEmojiPresets } from "../lib/emojiLabels";
import { colors, radius, spacing } from "../theme/colors";

interface EmojiSelectorProps {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
}

const COLUMNS = 5;
const VISIBLE_ROWS = 3;
const BUTTON_WIDTH_PERCENT = "18%"; // 5 * 18% = 90%, remaining 10% split across 4 gaps

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export default function EmojiSelector({ onSelect, selectedEmoji }: EmojiSelectorProps) {
  const emojiPresets = getEmojiPresets();
  const rows = useMemo(() => chunk(emojiPresets, COLUMNS), [emojiPresets]);

  return (
    <View style={styles.card}>
      <ScrollView style={styles.scrollArea} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map(({ emoji, label }, colIndex) => {
              const isSelected = selectedEmoji === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => onSelect(emoji)}
                  accessibilityLabel={label}
                  style={[
                    styles.emojiButton,
                    colIndex < COLUMNS - 1 && styles.emojiButtonSpacing,
                    isSelected && styles.emojiButtonSelected,
                  ]}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary + "33", // ~20% opacity, matches border-primary/20
    padding: spacing.sm,
  },
  scrollArea: {
    maxHeight: 210, // approx. 3 rows at typical phone widths (buttons are ~18% width, square)
  },
  row: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  emojiButton: {
    width: BUTTON_WIDTH_PERCENT,
    aspectRatio: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiButtonSpacing: {
    marginRight: "2.5%",
  },
  emojiButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emojiText: {
    fontSize: 22,
  },
});
