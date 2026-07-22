/**
 * Seed mínimo de dominio (issuer). Para Admin Auth + users usá:
 *   npm run admin:create -- --email ... --password ...
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL es requerida para el seed");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const issuer = await prisma.issuerProfile.upsert({
    where: { id: "seed-issuer-profile" },
    update: {
      name: "Emisor MVP",
      isActive: true,
      tenantId: null,
    },
    create: {
      id: "seed-issuer-profile",
      name: "Emisor MVP",
      isActive: true,
      tenantId: null,
    },
  });

  console.log(`Issuer activo: ${issuer.id} (${issuer.name})`);
  console.log(
    'Para crear el Admin: npm run admin:create -- admin@empresa.com "TuPassword"',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
