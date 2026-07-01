// Ported from the web app's src/integrations/supabase/client.ts.
// Only change: localStorage -> AsyncStorage, since React Native has no
// browser storage. Everything else (URL, key, query behavior) is identical.
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://uuijigmwkpmakltymkqe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1aWppZ213a3BtYWtsdHlta3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0MzUwNjAsImV4cCI6MjA3NzAxMTA2MH0.ZgzrBSgPe6Wpxc276xVySsf3vlTCpTSStgQSqSwtIqU";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // no browser URL to parse magic links from
  },
});
