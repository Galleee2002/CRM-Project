"use server";

import { redirect } from "next/navigation";

import {
  getSession,
  login,
  logout,
  type LoginInput,
  type SessionUserDto,
} from "@/features/auth/services/auth-service";
import type { ActionResult } from "@/lib/action-result";
import { getRequestMeta } from "@/lib/request-meta";

export async function loginAction(
  input: LoginInput,
): Promise<ActionResult<{ user: SessionUserDto }>> {
  const meta = await getRequestMeta();
  return login(input, meta);
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}

export async function getSessionAction(): Promise<
  ActionResult<{ user: SessionUserDto | null }>
> {
  return getSession();
}
