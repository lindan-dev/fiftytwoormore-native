import { supabase } from "../integrations/supabase/client";
import { reportError } from "./monitoring";

/**
 * Wraps supabase.functions.invoke() to explicitly attach the current
 * session's access token as the Authorization header, rather than
 * relying on the SDK to attach it automatically.
 *
 * Why this exists: a real production failure showed edge functions
 * receiving the anon key instead of the user's session token (surfaced
 * server-side as "Invalid token: invalid claim: missing sub claim" -
 * the anon key is a structurally valid JWT but has no "sub"/user-id
 * claim). The client-side call itself reported no error, since
 * `functions.invoke()` doesn't distinguish "sent the wrong token" from
 * "sent no token" - it silently falls back to the anon key whenever it
 * doesn't have a fresher one on hand. Fetching and attaching the token
 * explicitly here removes that ambiguity entirely.
 *
 * Only relevant for functions that check `Authorization` themselves via
 * `supabase.auth.getUser(token)` - i.e. everything except
 * notify-user-signup, which runs before any session exists (right after
 * signUp(), pre-email-confirmation) and needs a different fix entirely
 * (removing its auth requirement server-side, not attaching a token that
 * can't exist yet).
 */
export async function invokeFunction<T = any>(
  name: string,
  options?: { body?: Record<string, unknown> },
): Promise<{ data: T | null; error: Error | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined;
  const result = await supabase.functions.invoke<T>(name, { ...options, headers });
  if (result.error) {
    // 4xx is the function saying "no" to a bad request (for example a mistyped invitation
    // code): expected, not worth an alert. 5xx and network failures are real problems.
    const status = (result.error as { context?: { status?: number } }).context?.status;
    if (!status || status >= 500) reportError(result.error, { flow: "edge_function", function_name: name });
  }
  return result;
}
