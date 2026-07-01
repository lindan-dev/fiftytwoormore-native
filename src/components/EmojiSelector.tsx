// Ported from src/components/EmojiSelector.tsx.
// shadcn Card/Button -> View/Pressable + StyleSheet. Grid uses flexWrap
// instead of CSS grid (RN has no grid layout).
import { View, Text, Pressable, StyleSheet } from "react-native";
import { getEmojiPresets } from "../lib/emojiLabels";
import { colors, radius, spacing } from "../theme/colors";

interface EmojiSelectorProps {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
}

export default function EmojiSelector({ onSelect, selectedEmoji }: EmojiSelectorProps) {
  const emojiPresets = getEmojiPresets();

  return (
    <View style={styles.card}>
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
    </View>
  );
}

const EMOJI_SIZE = 40;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary + "33", // ~20% opacity, matches border-primary/20
    padding: spacing.sm,
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
    fontSize: 20,
  },
});
