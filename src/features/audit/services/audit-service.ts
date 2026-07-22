import { prisma } from "@/lib/prisma";

export type RecordAuditInput = {
  userId?: string | null;
  clientId?: string | null;
  entity: string;
  entityId: string;
  action: string;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

function serializeValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

/** Append-only audit writer. Never update or delete audit rows from the app. */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      clientId: input.clientId ?? null,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      field: input.field ?? null,
      oldValue: serializeValue(input.oldValue),
      newValue: serializeValue(input.newValue),
      reason: input.reason ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export type ListAuditLogsInput = {
  clientId?: string;
  userId?: string;
  entity?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listAuditLogs(input: ListAuditLogsInput = {}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where = {
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.entity ? { entity: input.entity } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lte: input.to } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}
