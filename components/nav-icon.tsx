export function NavIcon({ href }: { href: string }) {
  const path = iconPath(href);
  return (
    <span className="nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d={path} />
      </svg>
    </span>
  );
}

function iconPath(href: string) {
  if (href === "/sistema") return "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z";
  if (href.includes("documentos")) return "M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 1.5V9h4.5";
  if (href.includes("organograma")) return "M12 3v4M8 11v4M16 11v4M4 19h6M14 19h6M7 7h10v4H7z";
  if (href.includes("acesso") || href.includes("usuarios")) return "M8 11V8a4 4 0 0 1 8 0v3M6 11h12v9H6z";
  if (href.includes("auditoria")) return "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5";
  if (href.includes("anexos")) return "M8 12.5 14.5 6a3 3 0 0 1 4.2 4.2l-7.8 7.8a2 2 0 0 1-2.8-2.8l7.1-7.1";
  if (href.includes("trabalhadores") || href.includes("admissoes")) return "M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2.2-2.9M16 5.1a3 3 0 0 1 0 5.8";
  if (href.includes("tesouraria") || href.includes("conselho")) return "M4 7h16v11H4zM4 11h16M8 15h3";
  if (href.includes("juridico")) return "M12 3v3M8 21h8M9 8h6l1 10H8z";
  return "M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z";
}
