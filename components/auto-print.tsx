"use client";

import { useEffect } from "react";

/** Abre a janela de impressão assim que a página carrega (telas próprias de impressão). */
export function AutoPrint() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
