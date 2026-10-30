import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lar da Bênção",
  description: "Sistema institucional do Centro Espírita Filantrópico Lar da Bênção",
  robots: { index: false, follow: false }
};

// O visual aprovado é o claro. O tema escuro só entra quando a pessoa escolhe no menu.
// Menu lateral: a escolha salva no aparelho vale; sem escolha, fica recolhido em telas de 721 a 1199 px (tablet); no celular o menu abre pelo botão Menu.
const THEME_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);}catch(e){}var s=null;try{s=localStorage.getItem("sidebar-collapsed");}catch(e){}var w=window.innerWidth;d.setAttribute("data-sidebar",w>720&&(s==="1"||(s===null&&w<1200))?"collapsed":"open");})();`;

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
