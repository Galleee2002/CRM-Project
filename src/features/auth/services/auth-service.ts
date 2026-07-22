import { z } from "zod";

import { recordAudit } from "@/features/audit/services/audit-service";
import {
  checkLoginRateLimit,
  recordLoginAttempt,
} from "@/features/auth/services/rate-limit";
import { getAdminSession } from "@/features/auth/services/require-admin";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { zodErrorToResult } from "@/lib/zod-error";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type LoginContext = {
  ip?: string | null;
  userAgent?: string | null;
};

export type SessionUserDto = {
  id: string;
  email: string;
  fullName: string | null;
  role: "admin";
};

export async function login(
  raw: LoginInput,
  context: LoginContext = {},
): Promise<ActionResult<{ user: SessionUserDto }>> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip = context.ip ?? null;

  const rate = await checkLoginRateLimit({ email, ip });
  if (!rate.allowed) {
    return fail(
      "business_rule",
      rate.message ?? "Login bloqueado temporalmente",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    await recordLoginAttempt({ email, ip, success: false });
    return fail("unauthorized", "Credenciales inválidas");
  }

  const appUser = await prisma.user.findUnique({
    where: { authUserId: data.user.id },
  });

  if (!appUser || !appUser.isActive || appUser.role !== "admin") {
    await supabase.auth.signOut();
    await recordLoginAttempt({ email, ip, success: false });
    return fail("forbidden", "El usuario no tiene rol Admin");
  }

  await recordLoginAttempt({ email, ip, success: true });

  return ok({
    user: {
      id: appUser.id,
      email: appUser.email,
      fullName: appUser.fullName,
      role: "admin",
    },
  });
}

export async function logout(): Promise<ActionResult<{ success: true }>> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return ok({ success: true });
}

export async function getSession(): Promise<
  ActionResult<{ user: SessionUserDto | null }>
> {
  const session = await getAdminSession();
  if (!session) {
    return ok({ user: null });
  }

  return ok({
    user: {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: "admin",
    },
  });
}

export async function ensureAdminProfileAudited(input: {
  authUserId: string;
  email: string;
  fullName?: string | null;
  actorUserId?: string | null;
}): Promise<ActionResult<SessionUserDto>> {
  const existing = await prisma.user.findUnique({
    where: { authUserId: input.authUserId },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: input.email.trim().toLowerCase(),
        fullName: input.fullName ?? existing.fullName,
        role: "admin",
        isActive: true,
      },
    });

    if (
      existing.email !== updated.email ||
      existing.fullName !== updated.fullName
    ) {
      await recordAudit({
        userId: input.actorUserId ?? updated.id,
        entity: "user",
        entityId: updated.id,
        action: "update",
        field: "profile",
        oldValue: {
          email: existing.email,
          fullName: existing.fullName,
        },
        newValue: {
          email: updated.email,
          fullName: updated.fullName,
        },
      });
    }

    return ok({
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: "admin",
    });
  }

  const created = await prisma.user.create({
    data: {
      authUserId: input.authUserId,
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName ?? null,
      role: "admin",
      isActive: true,
    },
  });

  await recordAudit({
    userId: input.actorUserId ?? created.id,
    entity: "user",
    entityId: created.id,
    action: "create",
    newValue: {
      email: created.email,
      role: created.role,
    },
  });

  return ok({
    id: created.id,
    email: created.email,
    fullName: created.fullName,
    role: "admin",
  });
}
