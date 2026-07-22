import { describe, expect, it } from "vitest";

import {
  isValidDocument,
  normalizeDocumentNumber,
} from "@/lib/document";

describe("document validation", () => {
  it("normaliza guiones y puntos", () => {
    expect(normalizeDocumentNumber("20-12345678-3")).toBe("20123456783");
  });

  it("valida DNI de 7 u 8 dígitos", () => {
    expect(isValidDocument("DNI", "1234567")).toBe(true);
    expect(isValidDocument("DNI", "12345678")).toBe(true);
    expect(isValidDocument("DNI", "123")).toBe(false);
  });

  it("valida CUIT con dígito verificador", () => {
    // CUIT válido conocido: 20-12345678-6 (recalculate)
    // Using algorithm: for digits 20123456786
    expect(isValidDocument("CUIT", "20123456786")).toBe(true);
    expect(isValidDocument("CUIT", "20123456780")).toBe(false);
    expect(isValidDocument("CUIT", "2012345678")).toBe(false);
  });

  it("valida CUIL con el mismo algoritmo", () => {
    expect(isValidDocument("CUIL", "20123456786")).toBe(true);
  });
});
