import { describe, expect, it } from "vitest";

import { safeInternalPath } from "@/lib/safe-redirect";
import { hardenCookieOptions } from "@/lib/cookie-options";
import { getClientIpFromHeaders } from "@/lib/request-meta";
import { createClientSchema } from "@/features/clients/schemas/client-schemas";
import * as auditApi from "@/features/audit/index";

describe("safeInternalPath", () => {
  it("acepta paths relativos internos", () => {
    expect(safeInternalPath("/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/clientes/abc")).toBe("/clientes/abc");
  });

  it("rechaza open redirects", () => {
    expect(safeInternalPath("https://evil.com")).toBeNull();
    expect(safeInternalPath("//evil.com")).toBeNull();
    expect(safeInternalPath("/\\evil.com")).toBeNull();
    expect(safeInternalPath("dashboard")).toBeNull();
    expect(safeInternalPath("")).toBeNull();
  });
});

describe("hardenCookieOptions", () => {
  it("fuerza httpOnly, sameSite lax y topea maxAge", () => {
    const options = hardenCookieOptions({
      httpOnly: false,
      sameSite: "none",
      maxAge: 60 * 60 * 24 * 400,
    });
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.maxAge).toBe(60 * 60 * 24 * 7);
    expect(options.path).toBe("/");
  });
});

describe("getClientIpFromHeaders", () => {
  it("toma el primer hop de x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4, 5.6.7.8",
    });
    expect(getClientIpFromHeaders(headers)).toBe("1.2.3.4");
  });

  it("usa x-real-ip como fallback", () => {
    const headers = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(getClientIpFromHeaders(headers)).toBe("9.9.9.9");
  });
});

describe("createClientSchema bounds", () => {
  it("rechaza notes demasiado largas", () => {
    const parsed = createClientSchema.safeParse({
      type: "empresa",
      legalName: "Acme",
      documentType: "CUIT",
      documentNumber: "20123456786",
      taxCondition: "RI",
      notes: "x".repeat(2001),
    });
    expect(parsed.success).toBe(false);
  });
});

describe("audit app API", () => {
  it("exporta solo recordAudit y listAuditLogs", () => {
    expect(typeof auditApi.recordAudit).toBe("function");
    expect(typeof auditApi.listAuditLogs).toBe("function");
    expect(auditApi).not.toHaveProperty("updateAudit");
    expect(auditApi).not.toHaveProperty("deleteAudit");
  });
});
