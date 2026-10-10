import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/navigation/RootNavigator";
import { addNotificationTapListener } from "./src/lib/pushNotifications";
import { initMonitoring, wrapRoot } from "./src/lib/monitoring";

// As early as possible, so errors during startup are captured too.
initMonitoring();

function App() {
  useEffect(() => {
    const subscription = addNotificationTapListener();
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default wrapRoot(App);
