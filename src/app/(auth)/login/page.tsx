import { LoginForm } from "@/features/auth/components/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main>
      <h1>Ingreso Admin</h1>
      <p>Solo usuarios con rol Admin en el deployment.</p>
      <LoginForm nextPath={params.next} />
    </main>
  );
}
