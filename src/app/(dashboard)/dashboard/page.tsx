import Link from "next/link";

import {
  getSessionAction,
  logoutAction,
} from "@/features/auth/actions/auth-actions";

export default async function DashboardPage() {
  const session = await getSessionAction();
  const user = session.ok ? session.data.user : null;

  return (
    <main>
      <h1>Dashboard</h1>
      {user ? (
        <p>
          Sesión: {user.email} ({user.role})
        </p>
      ) : null}
      <nav>
        <p>H1 listo para UI: clientes y auditoría vía Server Actions.</p>
        <ul>
          <li>
            Contrato: <code>docs/CONTRATO-FRONTEND.md</code>
          </li>
        </ul>
      </nav>
      <form action={logoutAction}>
        <button type="submit">Cerrar sesión</button>
      </form>
      <p>
        <Link href="/">Inicio</Link>
      </p>
    </main>
  );
}
