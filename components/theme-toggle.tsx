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
    <button type="button" className="button theme-toggle" onClick={toggle}>
      {theme === "dark" ? "Tema claro" : "Tema escuro"}
    </button>
  );
}
