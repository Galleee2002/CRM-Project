import { redirect } from "next/navigation";

import { getAdminSession } from "@/features/auth/services/require-admin";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }

  return <section>{children}</section>;
}
