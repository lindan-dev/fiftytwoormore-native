// Ported from src/components/Onboarding.tsx. Same slide content and
// analytics tracking calls as the web version.
import { useEffect, useState } from "react";
import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heart, Clock, Calendar, Lock, Flame, LucideIcon } from "lucide-react-native";
import { useAnalytics } from "../hooks/useAnalytics";
import { colors, radius, spacing } from "../theme/colors";

interface Slide {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  isFinal?: boolean;
}

const slides: Slide[] = [
  {
    icon: Heart,
    title: "Because done is better than perfect ❤️",
    subtitle: "Relationships aren't about perfection. They're about showing up, again and again.",
  },
  {
    icon: Clock,
    title: "Make more time for each other 😍",
    subtitle: "Life gets busy. This tiny app helps you actually make time for intimacy.",
  },
  {
    icon: Calendar,
    title: "52 or more 📆",
    subtitle: "Once a week, every week. Just log it, keep your streak, and celebrate consistency.",
  },
  {
    icon: Lock,
    title: "Private. Always 🔐",
    subtitle: "Only you and your partner can see your data. No tracking, no ads, no nothing.",
  },
  {
    icon: Heart,
    title: "Cheaper than therapy 💰",
    subtitle: "Save time and money, while having so much more fun.",
  },
  {
    icon: Flame,
    title: "Start your streak 🔥",
    subtitle: "Reconnect. Laugh. Because intimacy is built one small moment at a time.",
    isFinal: true,
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { track } = useAnalytics();
  const currentSlideData = slides[currentSlide];
  const Icon = currentSlideData.icon;

  useEffect(() => {
    track("onboarding_started");
  }, [track]);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      track("onboarding_completed");
      onComplete();
    }
  };

  const handleSkip = () => {
    track("onboarding_skipped", { at_slide: currentSlide });
    setCurrentSlide(slides.length - 1);
  };

  const handleComplete = () => {
    track("onboarding_completed");
    onComplete();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.dotsRow}>
          {slides.map((_, index) => (
            <View key={index} style={[styles.dot, index === currentSlide && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon size={44} color={colors.primary} />
          </View>
          <Text style={styles.title}>{currentSlideData.title}</Text>
          <Text style={styles.subtitle}>{currentSlideData.subtitle}</Text>
        </View>

        <View style={styles.nav}>
          {currentSlideData.isFinal ? (
            <Pressable style={styles.primaryButton} onPress={handleComplete}>
              <Text style={styles.primaryButtonText}>Get Streaky</Text>
            </Pressable>
          ) : (
            <>
              <Pressable style={styles.primaryButton} onPress={handleNext}>
                <Text style={styles.primaryButtonText}>Next</Text>
              </Pressable>
              <Pressable style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} Lindan AB. All rights reserved.</Text>
          <Pressable onPress={() => Linking.openURL("mailto:fiftytwoormore@lindaninc.com")}>
            <Text style={[styles.footerText, styles.footerLink]}>Contact: fiftytwoormore@lindaninc.com</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: colors.muted,
  },
  dotActive: {
    width: 32,
    backgroundColor: colors.primary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    minHeight: 360,
    justifyContent: "flex-start",
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary + "1a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: "center",
    lineHeight: 22,
  },
  nav: {
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
    fontSize: 16,
  },
  skipButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  skipButtonText: {
    color: colors.mutedForeground,
    fontSize: 15,
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
});
