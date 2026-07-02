// Ported from src/pages/ResetPassword.tsx. Reached via deep link
// (fiftytwoormore://reset-password) after the user taps the reset email
// link. RootNavigator intercepts that link, exchanges the recovery tokens
// for a session, and renders this screen directly (not as a pushed stack
// screen) - hence onDone rather than navigation.goBack().
import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { Heart } from "lucide-react-native";
import { z } from "zod";
import { supabase } from "../integrations/supabase/client";
import { colors, radius, spacing } from "../theme/colors";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

interface ResetPasswordScreenProps {
  onDone: () => void;
}

export default function ResetPasswordScreen({ onDone }: ResetPasswordScreenProps) {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const result = passwordSchema.safeParse({ password, confirmPassword });
      if (!result.success) {
        Alert.alert("Validation Error", result.error.errors[0].message);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: result.data.password });
      if (error) throw error;

      Alert.alert("Password updated!", "Your password has been successfully reset.");
      onDone();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Heart size={28} color="#fff" fill="#fff" />
        </View>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your new password below</Text>

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="New Password"
          secureTextEntry
          editable={!loading}
          style={styles.input}
          placeholderTextColor={colors.mutedForeground}
        />
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm New Password"
          secureTextEntry
          editable={!loading}
          style={styles.input}
          placeholderTextColor={colors.mutedForeground}
        />

        <Pressable style={styles.primaryButton} onPress={handleResetPassword} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.primaryButtonText}>Update Password</Text>}
        </Pressable>
        <Pressable onPress={onDone} disabled={loading} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary + "33",
    padding: spacing.xl,
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  input: {
    width: "100%",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
    fontSize: 16,
  },
  ghostButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  ghostButtonText: {
    color: colors.mutedForeground,
  },
});
