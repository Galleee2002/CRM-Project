/**
 * Crea (o reutiliza) el Admin en Supabase Auth y lo vincula en `users` + `issuer_profiles`.
 *
 * Uso (recomendado en Windows/PowerShell — args posicionales):
 *   npm run admin:create -- admin@empresa.com "Secreta123!"
 *   npm run admin:create -- admin@empresa.com "Secreta123!" "Admin"
 *
 * Con flags (si npm los preserva):
 *   npm run admin:create -- --email admin@empresa.com --password "Secreta123!"
 *
 * También lee ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_FULL_NAME desde .env
 */
import "dotenv/config";

import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

/** Args después del script; ignora flags tipo --email. */
function positionalArgs(): string[] {
  const raw = process.argv.slice(2);
  const result: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    if (token.startsWith("--")) {
      if (i + 1 < raw.length && !raw[i + 1].startsWith("--")) {
        i += 1;
      }
      continue;
    }
    result.push(token);
  }
  return result;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

async function ensureIssuer(prisma: PrismaClient) {
  return prisma.issuerProfile.upsert({
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
}

async function findAuthUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  const normalized = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw error;
    }

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === normalized,
    );
    if (match) {
      return match;
    }

    if (data.users.length < perPage) {
      return null;
    }
    page += 1;
  }
}

async function main() {
  const positional = positionalArgs();
  const email = (
    readArg("--email") ??
    positional[0] ??
    process.env.ADMIN_EMAIL ??
    ""
  )
    .trim()
    .toLowerCase();
  const password =
    readArg("--password") ??
    positional[1] ??
    process.env.ADMIN_PASSWORD ??
    "";
  const fullName =
    readArg("--name") ??
    positional[2] ??
    process.env.ADMIN_FULL_NAME ??
    "Admin";

  if (!email || !password) {
    throw new Error(
      'Indicá email y password: npm run admin:create -- admin@x.com "TuPassword"',
    );
  }
  if (password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const databaseUrl = requireEnv("DATABASE_URL");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const issuer = await ensureIssuer(prisma);

    let authUserId: string;
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (created.error || !created.data.user) {
      const existing = await findAuthUserByEmail(supabase, email);
      if (!existing) {
        throw created.error ?? new Error("No se pudo crear el usuario en Auth");
      }

      const updated = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (updated.error || !updated.data.user) {
        throw updated.error ?? new Error("No se pudo actualizar el usuario Auth");
      }

      authUserId = updated.data.user.id;
      console.log(`Usuario Auth existente reutilizado: ${email}`);
    } else {
      authUserId = created.data.user.id;
      console.log(`Usuario Auth creado: ${email}`);
    }

    const appUser = await prisma.user.upsert({
      where: { authUserId },
      update: {
        email,
        fullName,
        role: "admin",
        isActive: true,
      },
      create: {
        authUserId,
        email,
        fullName,
        role: "admin",
        isActive: true,
      },
    });

    console.log(`Admin listo en users.id=${appUser.id}`);
    console.log(`authUserId=${authUserId}`);
    console.log(`Issuer activo: ${issuer.id} (${issuer.name})`);
    console.log("Ya podés ingresar en /login con ese email y password.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
