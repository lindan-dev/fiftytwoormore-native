// Feature flags (BACKLOG.md Ticket 17). The flag itself lives in the database
// (table feature_flags: off / beta / on); this file only asks "is it on for me?".
//
// Fail closed at start: until the database has answered "yes", a feature counts as
// OFF. After that, a failed re-check (offline, timeout) keeps the last answer so the UI
// doesn't flicker, while an explicit "no" turns the feature off at once. The database
// enforces the same flag on its own, so this is about not showing UI that wouldn't
// work, not about security.
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "../integrations/supabase/client";

/** true/false is the database's answer; null means "couldn't find out". */
export async function fetchFeatureEnabled(key: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc("feature_enabled", { flag_key: key });
    if (error) return null;
    return data === true;
  } catch {
    return null;
  }
}

/** True when the flag is on for the signed-in user. Re-checked whenever the app returns to the foreground. */
export function useFeatureFlag(key: string): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const value = await fetchFeatureEnabled(key);
      if (!cancelled && value !== null) setEnabled(value);
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [key]);

  return enabled;
}
