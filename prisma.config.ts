import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migraciones requieren conexión directa (Supabase :5432), no el pooler :6543.
    url: env("DIRECT_URL"),
  },
});
