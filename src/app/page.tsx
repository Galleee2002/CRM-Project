import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>CRM + Facturación ARCA</h1>
      <p>
        Backend H1: Auth Admin, CRM y auditoría. Stack: Next.js, Prisma,
        Supabase Auth/Storage.
      </p>
      <p>
        <Link href="/login">Ir al login</Link>
      </p>
    </main>
  );
}
