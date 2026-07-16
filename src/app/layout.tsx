import type { Metadata } from "next";

import "./globals.scss";

export const metadata: Metadata = {
  title: "CRM Project",
  description: "CRM con facturación electrónica ARCA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
