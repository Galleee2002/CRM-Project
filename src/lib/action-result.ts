export type ActionErrorCode =
  | "validation_error"
  | "business_rule"
  | "fiscal_rejected"
  | "fiscal_technical_error"
  | "conflict"
  | "unauthorized"
  | "forbidden"
  | "not_found";

export type ActionError = {
  code: ActionErrorCode;
  message: string;
  fields?: Record<string, string[]>;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: ActionErrorCode,
  message: string,
  fields?: Record<string, string[]>,
): ActionResult<T> {
  return {
    ok: false,
    error: { code, message, fields },
  };
}
