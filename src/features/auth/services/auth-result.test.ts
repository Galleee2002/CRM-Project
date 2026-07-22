import { describe, expect, it } from "vitest";

import { fail, ok } from "@/lib/action-result";

describe("action result helpers", () => {
  it("ok / fail shapes", () => {
    expect(ok({ a: 1 })).toEqual({ ok: true, data: { a: 1 } });
    expect(fail("unauthorized", "x")).toEqual({
      ok: false,
      error: { code: "unauthorized", message: "x" },
    });
  });
});
