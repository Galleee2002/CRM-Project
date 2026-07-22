import type { User } from "@/generated/prisma/client";
import { fail, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type AdminSession = {
  authUserId: string;
  user: User;
};

export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
  });

  if (!user || !user.isActive || user.role !== "admin") {
    return null;
  }

  return {
    authUserId: authUser.id,
    user,
  };
}

export async function requireAdmin(): Promise<
  ActionResult<AdminSession>
> {
  const session = await getAdminSession();
  if (!session) {
    return fail("unauthorized", "Debés iniciar sesión como Admin");
  }
  return { ok: true, data: session };
}
