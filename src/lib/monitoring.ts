// Crash and error reporting (Sentry), set up to collect as little as possible.
//
// What is sent: an error message, a stack trace, and technical device context (model,
// OS version, app version). What is NOT sent, by design:
//   - no user identity: we never call Sentry.setUser, and any user object is stripped
//   - no IP address (sendDefaultPii is off) and no request data
//   - no screenshots or view hierarchy (those could show partner names, notes and emojis)
//   - no console output and no network breadcrumbs (URLs can contain user ids)
//   - no performance tracing and no session tracking
// Reporting is off in development builds, and off in any build that has no DSN, so the
// app never depends on it: if EXPO_PUBLIC_SENTRY_DSN is missing this module does nothing.
import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
let enabled = false;

export function initMonitoring(): void {
  if (!dsn || __DEV__) return;
  Sentry.init({
    dsn,
    environment: "production",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeBreadcrumb: (breadcrumb) =>
      breadcrumb.category === "console" || breadcrumb.category === "fetch" || breadcrumb.category === "xhr"
        ? null
        : breadcrumb,
    beforeSend: (event) => {
      delete event.user;
      delete event.request;
      return event;
    },
  });
  enabled = true;
}

/** Wraps the root component so React render errors and touch breadcrumbs are captured. */
export const wrapRoot = Sentry.wrap;

/**
 * Reports an unexpected error. `flow` says where it happened (for example "auth_signup").
 * Pass only technical context, never emails, names, notes or locations.
 * Returns false when reporting is off (development build, or no DSN configured).
 */
export function reportError(error: unknown, context: { flow: string; function_name?: string }): boolean {
  if (!enabled) return false;
  const err =
    error instanceof Error
      ? error
      : new Error(
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : String(error),
        );
  Sentry.captureException(err, { tags: { flow: context.flow, ...(context.function_name ? { function: context.function_name } : {}) } });
  return true;
}

/**
 * Auth errors that are a normal part of using the app (wrong password, existing account,
 * unconfirmed email). These are not worth an alert; everything else, such as email rate
 * limits or network failures, is.
 */
export function isExpectedAuthError(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("invalid login credentials") ||
    m.includes("user already registered") ||
    m.includes("email not confirmed") ||
    m.includes("password should be at least") ||
    m.includes("unable to validate email address")
  );
}
