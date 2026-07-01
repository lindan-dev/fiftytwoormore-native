import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

// TODO: build out real YearInReview screen (see migration plan).
export default function YearInReviewScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>YearInReview — kommer snart</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  text: {
    fontSize: 18,
    color: colors.foreground,
  },
});
