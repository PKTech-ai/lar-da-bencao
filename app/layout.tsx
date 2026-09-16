import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lar da Bênção",
  description: "Sistema institucional do Centro Espírita Filantrópico Lar da Bênção",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
