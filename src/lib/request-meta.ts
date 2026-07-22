import { headers } from "next/headers";

/**
 * Client IP from trusted proxy headers only (never from request body).
 * Prefer the first hop of x-forwarded-for when present.
 */
export function getClientIpFromHeaders(
  headerStore: Headers,
): string | null {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 64);
    }
  }

  const realIp = headerStore.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 64);
  }

  return null;
}

export function getUserAgentFromHeaders(headerStore: Headers): string | null {
  const ua = headerStore.get("user-agent")?.trim();
  if (!ua) {
    return null;
  }
  return ua.slice(0, 512);
}

export async function getRequestMeta(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  const headerStore = await headers();
  return {
    ip: getClientIpFromHeaders(headerStore),
    userAgent: getUserAgentFromHeaders(headerStore),
  };
}
