// Ported from src/components/InvitationFlow.tsx. Same Supabase calls
// (couple_invitations table, notify-invitation-created / notify-partner-connected
// edge functions) as the web version.
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heart, Mail, Check, X } from "lucide-react-native";
import { supabase } from "../integrations/supabase/client";
import { colors, radius, spacing } from "../theme/colors";

interface Invitation {
  id: string;
  sender_id: string;
  receiver_email: string;
  status: string;
  created_at: string;
}

interface InvitationScreenProps {
  userEmail: string;
  userId: string;
  onConnected: () => void;
}

export default function InvitationScreen({ userEmail, userId, onConnected }: InvitationScreenProps) {
  const [partnerEmail, setPartnerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentInvitation, setSentInvitation] = useState<Invitation | null>(null);
  const [receivedInvitation, setReceivedInvitation] = useState<Invitation | null>(null);

  useEffect(() => {
    checkInvitations();
  }, []);

  const checkInvitations = async () => {
    const { data: sent } = await supabase
      .from("couple_invitations")
      .select("*")
      .eq("sender_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (sent) setSentInvitation(sent);

    const { data: received } = await supabase
      .from("couple_invitations")
      .select("*")
      .eq("receiver_email", userEmail)
      .eq("status", "pending")
      .maybeSingle();
    if (received) setReceivedInvitation(received);
  };

  const handleSendInvitation = async () => {
    if (!partnerEmail || partnerEmail === userEmail) {
      Alert.alert("Invalid email", "Please enter your partner's email address");
      return;
    }
    setLoading(true);
    try {
      const { data: newInvitation, error } = await supabase
        .from("couple_invitations")
        .insert([{ sender_id: userId, receiver_email: partnerEmail.toLowerCase().trim() }])
        .select()
        .single();
      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", userId)
        .single();

      if (newInvitation) {
        try {
          await supabase.functions.invoke("notify-invitation-created", {
            body: {
              receiverEmail: partnerEmail.toLowerCase().trim(),
              senderName: profile?.name || "Your partner",
              invitationId: newInvitation.id,
            },
          });
        } catch (emailError) {
          console.error("Error sending invitation email:", emailError);
        }
      }

      Alert.alert("Invitation sent!", "Your partner can now accept the invitation when they sign up.");
      checkInvitations();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!receivedInvitation) return;
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("couple_invitations")
        .update({ status: "accepted" })
        .eq("id", receivedInvitation.id);
      if (updateError) throw updateError;

      const { error: coupleError } = await supabase
        .from("couples")
        .insert([{ user1_id: receivedInvitation.sender_id, user2_id: userId }]);
      if (coupleError) throw coupleError;

      try {
        await supabase.functions.invoke("notify-partner-connected", {
          body: { senderId: receivedInvitation.sender_id, receiverId: userId },
        });
      } catch (emailError) {
        console.error("Error sending partner joined email:", emailError);
      }

      Alert.alert("Connected!", "You and your partner are now connected.");
      onConnected();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectInvitation = async () => {
    if (!receivedInvitation) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("couple_invitations")
        .update({ status: "rejected" })
        .eq("id", receivedInvitation.id);
      if (error) throw error;
      Alert.alert("Invitation declined", "You can accept a different invitation or send your own.");
      setReceivedInvitation(null);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Heart size={32} color="#fff" fill="#fff" />
          </View>
          <Text style={styles.title}>Connect with Your Partner</Text>
          <Text style={styles.subtitle}>
            To start tracking your activities together, invite your partner or accept their invitation.
          </Text>

          {receivedInvitation ? (
            <View style={styles.box}>
              <View style={styles.boxHeaderRow}>
                <Mail size={18} color={colors.primary} />
                <Text style={styles.boxHeaderText}>You have an invitation!</Text>
              </View>
              <Text style={styles.boxSubtext}>Someone wants to connect with you as their partner</Text>
              <View style={styles.buttonRow}>
                <Pressable style={styles.primaryButton} onPress={handleAcceptInvitation} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Check size={16} color={colors.primaryForeground} />
                      <Text style={styles.primaryButtonText}>Accept</Text>
                    </>
                  )}
                </Pressable>
                <Pressable style={styles.outlineButton} onPress={handleRejectInvitation} disabled={loading}>
                  <X size={16} color={colors.foreground} />
                  <Text style={styles.outlineButtonText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          ) : sentInvitation ? (
            <View style={[styles.box, { alignItems: "center" }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.boxHeaderText}>Invitation sent</Text>
              <Text style={styles.boxSubtext}>Waiting for {sentInvitation.receiver_email} to accept</Text>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>Partner's Email</Text>
              <TextInput
                value={partnerEmail}
                onChangeText={setPartnerEmail}
                placeholder="partner@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                style={styles.input}
                placeholderTextColor={colors.mutedForeground}
              />
              <Pressable
                style={[styles.primaryButton, styles.fullWidthButton, (!partnerEmail || loading) && styles.primaryButtonDisabled]}
                onPress={handleSendInvitation}
                disabled={loading || !partnerEmail}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Mail size={18} color={colors.primaryForeground} />
                    <Text style={styles.primaryButtonText}>Send Invitation</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  box: {
    width: "100%",
    backgroundColor: colors.primary + "0d",
    borderWidth: 2,
    borderColor: colors.primary + "33",
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  boxHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  boxHeaderText: {
    fontWeight: "600",
    color: colors.foreground,
  },
  boxSubtext: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  form: {
    width: "100%",
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.foreground,
  },
  primaryButton: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
  },
  fullWidthButton: {
    flex: undefined,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  outlineButton: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
  },
  outlineButtonText: {
    color: colors.foreground,
    fontWeight: "600",
  },
});
