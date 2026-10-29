import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Vender ingressos — Lar da Bênção",
  manifest: "/ingressos.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Ingressos" }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#356f8f" };

/** Casca mínima do trabalhador (acesso temporário): sem o menu do sistema. */
export default function SellerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
