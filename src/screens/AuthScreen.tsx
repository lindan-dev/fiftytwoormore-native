// Ported from src/components/Auth.tsx. Validation schema and Supabase calls
// are identical to the web version. Differences, all forced by the
// platform:
//  - shadcn Card/Input/Button -> RN View/TextInput/Pressable + StyleSheet
//  - toast() -> Alert.alert (swap for a native toast lib later if desired)
//  - "forgot password" redirect uses a deep link instead of window.location
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { Heart } from "lucide-react-native";
import { z } from "zod";
import * as Linking from "expo-linking";
import { supabase } from "../integrations/supabase/client";
import { colors, radius, spacing } from "../theme/colors";

const authSchema = z.object({
  email: z.string().trim().email("Ogiltig e-postadress").max(255),
  password: z.string().min(8, "Lösenordet måste vara minst 8 tecken").max(72),
  name: z.string().trim().min(1, "Namn krävs").max(100).optional(),
});

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleAuth = async () => {
    setLoading(true);
    try {
      if (isForgotPassword) {
        const result = z.string().trim().email("Ogiltig e-postadress").safeParse(email);
        if (!result.success) {
          Alert.alert("Valideringsfel", "Ange en giltig e-postadress");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(result.data, {
          redirectTo: Linking.createURL("reset-password"),
        });
        if (error) throw error;

        Alert.alert("Kolla din e-post", "Vi har skickat en återställningslänk.");
        setIsForgotPassword(false);
        setEmail("");
        setLoading(false);
        return;
      }

      const validationData = isSignUp ? { email, password, name } : { email, password };
      const result = authSchema.safeParse(validationData);
      if (!result.success) {
        Alert.alert("Valideringsfel", result.error.errors[0].message);
        setLoading(false);
        return;
      }

      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: result.data.email,
          password: result.data.password,
          options: { data: { name: result.data.name } },
        });
        if (error) throw error;

        try {
          await supabase.functions.invoke("notify-user-signup", {
            body: { email: result.data.email, name: result.data.name || "there" },
          });
        } catch (emailError) {
          console.error("Error sending welcome email:", emailError);
        }

        Alert.alert("Konto skapat!", "Du kan nu logga in med dina uppgifter.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: result.data.email,
          password: result.data.password,
        });
        if (error) throw error;
        // RootNavigator listens to onAuthStateChange and will switch
        // to the main app automatically once this resolves.
      }
    } catch (error: any) {
      Alert.alert("Fel", error.message ?? "Något gick fel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.screen}
    >
      <View style={styles.content}>
        <View style={styles.logoBlock}>
          <Heart size={40} color={colors.primary} />
          <Text style={styles.title}>fiftytwoormore</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isForgotPassword ? "Återställ lösenord" : isSignUp ? "Skapa konto" : "Logga in"}
          </Text>
          <Text style={styles.cardSubtitle}>
            {isForgotPassword
              ? "Ange din e-post för en återställningslänk"
              : isSignUp
              ? "Kom igång med fiftytwoormore"
              : "Välkommen tillbaka"}
          </Text>

          {isSignUp && !isForgotPassword && (
            <TextInput
              placeholder="Namn"
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholderTextColor={colors.mutedForeground}
            />
          )}

          <TextInput
            placeholder="E-post"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            placeholderTextColor={colors.mutedForeground}
          />

          {!isForgotPassword && (
            <TextInput
              placeholder="Lösenord"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={[styles.input, styles.inputLast]}
              placeholderTextColor={colors.mutedForeground}
            />
          )}

          <Pressable onPress={handleAuth} disabled={loading} style={styles.primaryButton}>
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isForgotPassword ? "Skicka länk" : isSignUp ? "Skapa konto" : "Logga in"}
              </Text>
            )}
          </Pressable>

          {!isForgotPassword && (
            <Pressable onPress={() => setIsSignUp(!isSignUp)} style={styles.linkButton}>
              <Text style={styles.linkText}>
                {isSignUp ? "Har du redan ett konto? Logga in" : "Inget konto? Skapa ett"}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => setIsForgotPassword(!isForgotPassword)}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>
              {isForgotPassword ? "Tillbaka till inloggning" : "Glömt lösenord?"}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  },
  logoBlock: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.foreground,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.cardForeground,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    color: colors.foreground,
  },
  inputLast: {
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  linkText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
});
