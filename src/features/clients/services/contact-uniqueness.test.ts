import { describe, expect, it } from "vitest";

/** Mirrors contact uniqueness rule enforced in client-service transactions. */
function countFlags(
  contacts: Array<{ isPrimary: boolean; isBilling: boolean }>,
) {
  return {
    primaryCount: contacts.filter((c) => c.isPrimary).length,
    billingCount: contacts.filter((c) => c.isBilling).length,
  };
}

describe("contact uniqueness rules", () => {
  it("permite un primario y un facturación", () => {
    const counts = countFlags([
      { isPrimary: true, isBilling: false },
      { isPrimary: false, isBilling: true },
      { isPrimary: false, isBilling: false },
    ]);
    expect(counts.primaryCount).toBe(1);
    expect(counts.billingCount).toBe(1);
  });

  it("detecta más de un primario", () => {
    const counts = countFlags([
      { isPrimary: true, isBilling: false },
      { isPrimary: true, isBilling: true },
    ]);
    expect(counts.primaryCount).toBeGreaterThan(1);
  });
});
