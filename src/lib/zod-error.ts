import { ZodError } from "zod";

import { fail, type ActionResult } from "@/lib/action-result";

export function zodErrorToResult<T = never>(
  error: ZodError,
): ActionResult<T> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    if (!fields[key]) {
      fields[key] = [];
    }
    fields[key].push(issue.message);
  }

  return fail("validation_error", "Datos inválidos", fields);
}
