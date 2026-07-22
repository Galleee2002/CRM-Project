import { z } from "zod";

import { entityIdSchema } from "@/features/clients/schemas/client-schemas";

export const listAuditLogsSchema = z.object({
  clientId: entityIdSchema.optional(),
  userId: entityIdSchema.optional(),
  entity: z.string().trim().max(100).optional(),
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});

export type ListAuditLogsActionInput = z.infer<typeof listAuditLogsSchema>;
