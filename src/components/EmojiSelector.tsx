// Ported from src/components/EmojiSelector.tsx.
// shadcn Card/Button -> View/Pressable + StyleSheet. Grid uses flexWrap
// instead of CSS grid (RN has no grid layout).
//
// Fixed 5x3 grid with its own internal ScrollView: with ~79 emoji
// presets, letting this grow to full height forces the whole create/edit
// dialog to scroll just to reach the save button. Containing the scroll
// here keeps the rest of the form (date, notes, location, save) reachable
// without scrolling. Button size is computed from screen width so exactly
// 5 columns fit on any device.
import { View, Text, Pressable, ScrollView, Dimensions, StyleSheet } from "react-native";
import { getEmojiPresets } from "../lib/emojiLabels";
import { colors, radius, spacing } from "../theme/colors";

interface EmojiSelectorProps {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
}

const COLUMNS = 5;
const VISIBLE_ROWS = 3;
// Screen width minus modal padding (spacing.lg * 2), card padding
// (spacing.sm * 2), and gaps between columns.
const CARD_HORIZONTAL_PADDING = spacing.sm * 2;
const MODAL_HORIZONTAL_PADDING = spacing.lg * 2;
const GAPS = (COLUMNS - 1) * spacing.xs;
const AVAILABLE_WIDTH = Dimensions.get("window").width - MODAL_HORIZONTAL_PADDING - CARD_HORIZONTAL_PADDING - GAPS;
const EMOJI_SIZE = Math.floor(AVAILABLE_WIDTH / COLUMNS);
const ROW_HEIGHT = EMOJI_SIZE + spacing.xs;

export default function EmojiSelector({ onSelect, selectedEmoji }: EmojiSelectorProps) {
  const emojiPresets = getEmojiPresets();

  return (
    <View style={styles.card}>
      <ScrollView style={styles.scrollArea} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {emojiPresets.map(({ emoji, label }) => {
            const isSelected = selectedEmoji === emoji;
            return (
              <Pressable
                key={emoji}
                onPress={() => onSelect(emoji)}
                accessibilityLabel={label}
                style={[styles.emojiButton, isSelected && styles.emojiButtonSelected]}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
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
    maxHeight: ROW_HEIGHT * VISIBLE_ROWS,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  emojiButton: {
    width: EMOJI_SIZE,
    height: EMOJI_SIZE,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emojiText: {
    fontSize: Math.floor(EMOJI_SIZE * 0.5),
  },
});
