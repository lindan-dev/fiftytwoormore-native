export const PENDING_INVITE_CODE_KEY = "fiftytwoormore:pendingInviteCode";

/**
 * Best-effort extraction of an invite code directly from a raw deep-link
 * URL string, independent of ExpoLinking.parse()'s structured query-param
 * parsing. Kept as a fallback in case that parsing ever misses (e.g. an
 * unexpected slash/host format for the custom scheme).
 */
export function extractInviteCode(url: string): string | null {
  const match = url.match(/[?&]code=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
