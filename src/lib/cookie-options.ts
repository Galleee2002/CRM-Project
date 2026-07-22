const MAX_SESSION_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Accepts Supabase SSR cookie option shapes (including sameSite: boolean). */
export type IncomingCookieOptions = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  priority?: "low" | "medium" | "high";
  partitioned?: boolean;
};

export type HardenedCookieOptions = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  priority?: "low" | "medium" | "high";
  partitioned?: boolean;
};

/** Harden Supabase SSR cookie options (httpOnly, secure in prod, capped lifetime). */
export function hardenCookieOptions(
  options: IncomingCookieOptions = {},
): HardenedCookieOptions {
  const maxAge =
    options.maxAge != null
      ? Math.min(options.maxAge, MAX_SESSION_AGE_SECONDS)
      : MAX_SESSION_AGE_SECONDS;

  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: options.path ?? "/",
    maxAge,
  };
}
