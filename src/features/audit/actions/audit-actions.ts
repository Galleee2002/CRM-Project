"use server";

import {
  listAuditLogsSchema,
  type ListAuditLogsActionInput,
} from "@/features/audit/schemas/audit-schemas";
import { listAuditLogs } from "@/features/audit/services/audit-service";
import { requireAdmin } from "@/features/auth/services/require-admin";
import { fail, type ActionResult } from "@/lib/action-result";
import { zodErrorToResult } from "@/lib/zod-error";

export type { ListAuditLogsActionInput };

export async function listAuditLogsAction(
  input: ListAuditLogsActionInput = {},
): Promise<ActionResult<Awaited<ReturnType<typeof listAuditLogs>>>> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth;
  }

  const parsed = listAuditLogsSchema.safeParse(input);
  if (!parsed.success) {
    return zodErrorToResult(parsed.error);
  }

  try {
    const data = await listAuditLogs({
      clientId: parsed.data.clientId,
      userId: parsed.data.userId,
      entity: parsed.data.entity,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    return { ok: true, data };
  } catch {
    return fail("business_rule", "No se pudo listar la auditoría");
  }
}
