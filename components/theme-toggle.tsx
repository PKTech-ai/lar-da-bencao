"use client";

import { useLayoutEffect, useState } from "react";

function currentTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  // Reaplica o atributo após o remount do Strict Mode em dev; no-op em produção.
  useLayoutEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(currentTheme());
  }, []);

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  }

  return (
    <button type="button" className="button theme-toggle" title={theme === "dark" ? "Tema claro" : "Tema escuro"} onClick={toggle}>
      <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z"/></svg></span>
      <span className="nav-label">{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
    </button>
  );
}
