import { useCallback, useEffect, useState } from "react";
import { ScrollView, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../integrations/supabase/client";
import StatsView from "../components/StatsView";
import { colors, spacing } from "../theme/colors";

interface Activity {
  id: string;
  activity_date: string;
}

export default function StatsScreen() {
  const navigation = useNavigation<any>();
  const [userId, setUserId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [anniversary, setAnniversary] = useState<string | null>(null);
  const [benchmarkOptIn, setBenchmarkOptIn] = useState(false);

  const fetchData = useCallback(async (uid: string) => {
    const { data: partnerId } = await supabase.rpc("get_partner_id", { user_id: uid });
    const userIds = partnerId ? [uid, partnerId] : [uid];

    const { data, error } = await supabase
      .from("activities")
      .select("id, activity_date")
      .in("user_id", userIds)
      .order("activity_date", { ascending: false });

    if (error) {
      Alert.alert("Error", "Failed to load stats");
    } else {
      setActivities(data || []);
    }

    const { data: coupleData } = await supabase
      .from("couples")
      .select("anniversary")
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .maybeSingle();

    if (coupleData) {
      setAnniversary(coupleData.anniversary ?? null);
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("benchmark_opt_in")
      .eq("user_id", uid)
      .maybeSingle();

    if (profileData) {
      setBenchmarkOptIn(!!profileData.benchmark_opt_in);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (uid) {
        setUserId(uid);
        fetchData(uid);
      }
    });
  }, [fetchData]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <StatsView
          activities={activities}
          anniversary={anniversary}
          benchmarkOptIn={benchmarkOptIn}
          onViewYearInReview={(year) => navigation.navigate("YearInReview", { year })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
});
