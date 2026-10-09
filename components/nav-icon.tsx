const ICONS: Record<string, string> = {
  home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
  document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8m-8 4h8"/>',
  org: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-5h14v5"/>',
  lock: '<rect x="4" y="10" width="16" height="12" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  book: '<path d="M12 5C8 2 5 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1Zm0 0v16"/>',
  child: '<circle cx="12" cy="4" r="2"/><path d="M5 9c5 2 9 2 14 0M12 10v6m0 0-5 6m5-6 5 6"/>',
  people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/>',
  heart: '<path d="M20.5 5.5a5 5 0 0 0-7 0L12 7l-1.5-1.5a5 5 0 0 0-7 7L12 21l8.5-8.5a5 5 0 0 0 0-7Z"/>',
  wallet: '<path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v12H5a3 3 0 0 1-3-3V6m19 7h-5v4h5"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 7 7m-15-12 2 2 4-4"/>',
  box: '<path d="m3 7 9-5 9 5v10l-9 5-9-5Zm0 0 9 5 9-5M12 12v10M7 4.8l9 5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
  megaphone: '<path d="m3 9 17-6v18L3 15zm0 0v6m4 2 1 5h4l-2-5M23 8v8"/>',
  scales: '<path d="M12 3v18m-6 0h12M3 7h18M5 7l-4 8h8Zm14 0-4 8h8Z"/>',
  building: '<path d="m2 8 10-6 10 6ZM4 11v8m5-8v8m6-8v8m5-8v8M2 22h20"/>'
};

function iconName(href: string) {
  if (href === "/sistema") return "home";
  if (href.includes("documentos") || href.includes("secretaria")) return "document";
  if (href.includes("organograma")) return "org";
  if (href.includes("acesso") || href.includes("usuarios")) return "lock";
  if (href.includes("doutrina")) return "book";
  if (href.includes("infancia")) return "child";
  if (href.includes("juventude") || href.includes("trabalhadores") || href.includes("admissoes")) return "people";
  if (href.includes("assistencia")) return "heart";
  if (href.includes("tesouraria")) return "wallet";
  if (href.includes("conselho")) return "search";
  if (href.includes("patrimonio")) return "box";
  if (href.includes("eventos")) return "calendar";
  if (href.includes("divulgacao")) return "megaphone";
  if (href.includes("juridico")) return "scales";
  if (href.includes("presidencia")) return "building";
  return "document";
}

export function NavIcon({ href }: { href: string }) {
  return (
    <span className="nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICONS[iconName(href)] }} />
    </span>
  );
}
