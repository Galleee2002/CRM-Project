export type AuditAction = "create" | "update" | "delete" | "emit";

export type AuditEntity =
  | "client"
  | "client_contact"
  | "client_address"
  | "user"
  | "issuer_profile";
