import { beforeEach, describe, expect, it, vi } from "vitest";

const { countMock, findManyMock, createMock, deleteManyMock } = vi.hoisted(
  () => ({
    countMock: vi.fn(),
    findManyMock: vi.fn(),
    createMock: vi.fn(),
    deleteManyMock: vi.fn(),
  }),
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    loginAttempt: {
      count: countMock,
      findMany: findManyMock,
      create: createMock,
      deleteMany: deleteManyMock,
    },
  },
}));

import {
  checkLoginRateLimit,
  recordLoginAttempt,
} from "@/features/auth/services/rate-limit";

describe("checkLoginRateLimit", () => {
  beforeEach(() => {
    countMock.mockReset();
    findManyMock.mockReset();
    createMock.mockReset();
    deleteManyMock.mockReset();
  });

  it("permite cuando hay pocos fallos por email e IP", async () => {
    countMock.mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    const result = await checkLoginRateLimit({
      email: "a@b.com",
      ip: "1.1.1.1",
    });

    expect(result.allowed).toBe(true);
    expect(countMock).toHaveBeenCalledTimes(2);
  });

  it("bloquea por email tras 5 fallos en ventana", async () => {
    countMock.mockResolvedValueOnce(5);
    findManyMock.mockResolvedValueOnce([
      { attemptedAt: new Date() },
      { attemptedAt: new Date() },
      { attemptedAt: new Date() },
      { attemptedAt: new Date() },
      { attemptedAt: new Date(Date.now() - 60_000) },
    ]);

    const result = await checkLoginRateLimit({
      email: "a@b.com",
      ip: null,
    });

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("bloquea por IP aunque el email sea nuevo", async () => {
    countMock.mockResolvedValueOnce(0).mockResolvedValueOnce(20);
    findManyMock.mockResolvedValue(
      Array.from({ length: 20 }, () => ({
        attemptedAt: new Date(),
      })),
    );

    const result = await checkLoginRateLimit({
      email: "nuevo@x.com",
      ip: "8.8.8.8",
    });

    expect(result.allowed).toBe(false);
  });
});

describe("recordLoginAttempt", () => {
  beforeEach(() => {
    createMock.mockReset();
    deleteManyMock.mockReset();
    createMock.mockResolvedValue({});
    deleteManyMock.mockResolvedValue({ count: 0 });
  });

  it("normaliza email y guarda IP de servidor", async () => {
    await recordLoginAttempt({
      email: "A@B.COM",
      ip: "10.0.0.1",
      success: false,
    });
    expect(createMock).toHaveBeenCalledWith({
      data: {
        email: "a@b.com",
        ip: "10.0.0.1",
        success: false,
      },
    });
  });
});
