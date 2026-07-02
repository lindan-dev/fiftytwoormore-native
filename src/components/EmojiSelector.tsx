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
// Button size is derived from the card's actual measured width
// (onLayout), not a guessed screen-width calculation - guessing at the
// surrounding padding produced oversized buttons that only fit 4 per row
// with leftover whitespace. Measuring the real width guarantees exactly
// 5 columns regardless of where this is placed or how much padding
// surrounds it.
import { useState } from "react";
import { View, Text, Pressable, ScrollView, LayoutChangeEvent, StyleSheet } from "react-native";
import { getEmojiPresets } from "../lib/emojiLabels";
import { colors, radius, spacing } from "../theme/colors";

interface EmojiSelectorProps {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
}

const COLUMNS = 5;
const VISIBLE_ROWS = 3;

export default function EmojiSelector({ onSelect, selectedEmoji }: EmojiSelectorProps) {
  const emojiPresets = getEmojiPresets();
  const [buttonSize, setButtonSize] = useState<number | null>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    // layout.width is the outer box width, i.e. it includes this View's
    // own horizontal padding - subtract it to get the actual content
    // width available for the emoji grid.
    const contentWidth = e.nativeEvent.layout.width - spacing.sm * 2;
    const gaps = (COLUMNS - 1) * spacing.xs;
    const size = Math.floor((contentWidth - gaps) / COLUMNS);
    if (size !== buttonSize) setButtonSize(size);
  };

  return (
    <View style={styles.card} onLayout={handleLayout}>
      {buttonSize && (
        <ScrollView
          style={{ maxHeight: (buttonSize + spacing.xs) * VISIBLE_ROWS }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {emojiPresets.map(({ emoji, label }) => {
              const isSelected = selectedEmoji === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => onSelect(emoji)}
                  accessibilityLabel={label}
                  style={[
                    styles.emojiButton,
                    { width: buttonSize, height: buttonSize },
                    isSelected && styles.emojiButtonSelected,
                  ]}
                >
                  <Text style={{ fontSize: Math.floor(buttonSize * 0.5) }}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  emojiButton: {
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
});
