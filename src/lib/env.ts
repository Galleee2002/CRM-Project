export function getPublicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}

export function getServerEnv() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const directUrl = process.env.DIRECT_URL ?? "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  return {
    databaseUrl,
    directUrl,
    supabaseServiceRoleKey,
  };
}

export function requireServerEnv() {
  const env = getServerEnv();
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL es requerida en el servidor");
  }
  return env;
}
