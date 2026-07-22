import { prisma } from "@/lib/prisma";

/** Returns the active issuer profile id for this deployment (MVP: single active). */
export async function getActiveIssuerProfileId(): Promise<string | null> {
  const profile = await prisma.issuerProfile.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return profile?.id ?? null;
}

export async function getActiveIssuerProfile() {
  return prisma.issuerProfile.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
}
