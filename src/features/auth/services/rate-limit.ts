import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const MAX_FAILURES_EMAIL = 5;
const MAX_FAILURES_IP = 20;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const PROGRESSIVE_DELAY_AFTER_IP_FAILURES = 10;

export type RateLimitCheck = {
  allowed: boolean;
  retryAfterSeconds?: number;
  message?: string;
};

async function checkFailureBucket(input: {
  email?: string;
  ip?: string;
  maxFailures: number;
}): Promise<RateLimitCheck> {
  const since = new Date(Date.now() - WINDOW_MS);

  const where = {
    success: false as const,
    attemptedAt: { gte: since },
    ...(input.email ? { email: input.email } : {}),
    ...(input.ip ? { ip: input.ip } : {}),
  };

  const failureCount = await prisma.loginAttempt.count({ where });

  if (failureCount < input.maxFailures) {
    if (
      input.ip &&
      failureCount >= PROGRESSIVE_DELAY_AFTER_IP_FAILURES
    ) {
      const extra = failureCount - PROGRESSIVE_DELAY_AFTER_IP_FAILURES + 1;
      const retryAfterSeconds = Math.min(60, extra * 2);
      return {
        allowed: false,
        retryAfterSeconds,
        message: `Demasiados intentos. Reintentá en ${retryAfterSeconds}s`,
      };
    }
    return { allowed: true };
  }

  const oldestBlocking = await prisma.loginAttempt.findMany({
    where,
    orderBy: { attemptedAt: "desc" },
    take: input.maxFailures,
  });

  const oldest =
    oldestBlocking[oldestBlocking.length - 1]?.attemptedAt ?? since;
  const newest = oldestBlocking[0]?.attemptedAt ?? since;

  const unlockAt = Math.max(
    oldest.getTime() + WINDOW_MS,
    newest.getTime() + LOCKOUT_MS,
  );
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((unlockAt - Date.now()) / 1000),
  );

  if (Date.now() < unlockAt) {
    return {
      allowed: false,
      retryAfterSeconds,
      message: `Demasiados intentos fallidos. Reintentá en ${retryAfterSeconds}s`,
    };
  }

  // Window has not slid enough yet — still at/over cap; keep blocking.
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(WINDOW_MS / 1000)),
    message: `Demasiados intentos fallidos. Reintentá más tarde`,
  };
}

export async function checkLoginRateLimit(input: {
  email: string;
  ip?: string | null;
}): Promise<RateLimitCheck> {
  const email = input.email.trim().toLowerCase();

  const byEmail = await checkFailureBucket({
    email,
    maxFailures: MAX_FAILURES_EMAIL,
  });
  if (!byEmail.allowed) {
    return byEmail;
  }

  if (input.ip) {
    const byIp = await checkFailureBucket({
      ip: input.ip,
      maxFailures: MAX_FAILURES_IP,
    });
    if (!byIp.allowed) {
      return byIp;
    }
  }

  return { allowed: true };
}

export async function purgeOldLoginAttempts(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  const result = await prisma.loginAttempt.deleteMany({
    where: { attemptedAt: { lt: cutoff } },
  });
  return result.count;
}

export async function recordLoginAttempt(input: {
  email: string;
  ip?: string | null;
  success: boolean;
}): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      email: input.email.trim().toLowerCase(),
      ip: input.ip ?? null,
      success: input.success,
    },
  });

  // Probabilistic purge to bound table growth without a separate job.
  if (Math.random() < 0.1) {
    await purgeOldLoginAttempts().catch(() => undefined);
  }
}
