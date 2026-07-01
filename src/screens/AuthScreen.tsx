// Ported from src/components/Auth.tsx. Validation schema and Supabase calls
// are identical to the web version. Differences, all forced by the
// platform:
//  - shadcn Card/Input/Button -> RN View/TextInput/Pressable + NativeWind
//  - toast() -> Alert.alert (swap for a native toast lib later if desired)
//  - "forgot password" redirect uses a deep link instead of window.location
import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Heart } from "lucide-react-native";
import { z } from "zod";
import * as Linking from "expo-linking";
import { supabase } from "../integrations/supabase/client";

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
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-8">
          <Heart size={40} color="hsl(10, 80%, 65%)" />
          <Text className="text-2xl font-bold text-foreground mt-3">fiftytwoormore</Text>
        </View>

        <View className="bg-card rounded-lg p-5 shadow-soft">
          <Text className="text-lg font-semibold text-card-foreground mb-1">
            {isForgotPassword ? "Återställ lösenord" : isSignUp ? "Skapa konto" : "Logga in"}
          </Text>
          <Text className="text-sm text-muted-foreground mb-4">
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
              className="border border-input rounded-md px-3 py-3 mb-3 text-foreground"
              placeholderTextColor="hsl(10, 10%, 45%)"
            />
          )}

          <TextInput
            placeholder="E-post"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            className="border border-input rounded-md px-3 py-3 mb-3 text-foreground"
            placeholderTextColor="hsl(10, 10%, 45%)"
          />

          {!isForgotPassword && (
            <TextInput
              placeholder="Lösenord"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              className="border border-input rounded-md px-3 py-3 mb-4 text-foreground"
              placeholderTextColor="hsl(10, 10%, 45%)"
            />
          )}

          <Pressable
            onPress={handleAuth}
            disabled={loading}
            className="bg-primary rounded-md py-3 items-center mb-3"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-primary-foreground font-semibold">
                {isForgotPassword ? "Skicka länk" : isSignUp ? "Skapa konto" : "Logga in"}
              </Text>
            )}
          </Pressable>

          {!isForgotPassword && (
            <Pressable onPress={() => setIsSignUp(!isSignUp)} className="items-center py-1">
              <Text className="text-sm text-muted-foreground">
                {isSignUp ? "Har du redan ett konto? Logga in" : "Inget konto? Skapa ett"}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => setIsForgotPassword(!isForgotPassword)}
            className="items-center py-1"
          >
            <Text className="text-sm text-muted-foreground">
              {isForgotPassword ? "Tillbaka till inloggning" : "Glömt lösenord?"}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
