const DNI_REGEX = /^\d{7,8}$/;
const CUIT_CUIL_REGEX = /^\d{11}$/;

/** Weights for CUIT/CUIL check digit (AFIP algorithm). */
const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

export type DocumentTypeInput = "CUIT" | "CUIL" | "DNI";

export function normalizeDocumentNumber(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export function isValidCuitOrCuil(digits: string): boolean {
  if (!CUIT_CUIL_REGEX.test(digits)) {
    return false;
  }

  const numbers = digits.split("").map(Number);
  const checkDigit = numbers[10];
  const sum = CUIT_WEIGHTS.reduce(
    (acc, weight, index) => acc + weight * numbers[index],
    0,
  );
  const mod = sum % 11;
  const expected = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod;

  return checkDigit === expected;
}

export function isValidDocument(
  type: DocumentTypeInput,
  rawNumber: string,
): boolean {
  const digits = normalizeDocumentNumber(rawNumber);

  switch (type) {
    case "DNI":
      return DNI_REGEX.test(digits);
    case "CUIT":
    case "CUIL":
      return isValidCuitOrCuil(digits);
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function documentValidationMessage(
  type: DocumentTypeInput,
): string {
  switch (type) {
    case "DNI":
      return "DNI inválido (7 u 8 dígitos)";
    case "CUIT":
      return "CUIT inválido (11 dígitos con dígito verificador)";
    case "CUIL":
      return "CUIL inválido (11 dígitos con dígito verificador)";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
