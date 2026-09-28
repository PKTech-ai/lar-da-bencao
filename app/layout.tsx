import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lar da Bênção",
  description: "Sistema institucional do Centro Espírita Filantrópico Lar da Bênção",
  robots: { index: false, follow: false }
};

// Sem preferência salva, o CSS segue prefers-color-scheme; este script só entra quando
// alguém escolheu explicitamente um tema (Sidebar), sobrepondo o padrão do sistema.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
