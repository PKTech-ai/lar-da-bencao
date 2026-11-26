"use client";

import { useEffect } from "react";

// Na hora de imprimir, o dia que passaria um pouco de uma folha tem a letra reduzida (até 82%) para caber inteiro
// numa folha só. Se nem assim couber, fica no tamanho normal e continua na folha seguinte, com o cabeçalho repetido.
// O botão do PDF (share-pdf-button) usa a mesma regra para montar as folhas.
export const PAGE_HEIGHT_PX = (194 * 96) / 25.4; // A4 deitada (210 mm) menos as margens de 8 mm em cima e embaixo
export const SAFETY = 0.97;
const MIN_SCALE = 0.82;

/** Deixa em --sp-scale a letra com que o dia cabe numa folha e a devolve; null (e letra normal) se nem reduzindo couber.
 *  Mede na largura da folha: o dia precisa estar dentro de .sp-measuring ou .sp-pdf (281 mm). */
export function fitDayScale(day: HTMLElement): number | null {
  const frame = day.querySelector<HTMLElement>(".sp-frame");
  if (!frame) return null;
  const avail = PAGE_HEIGHT_PX * SAFETY;
  const fits = (scale: number) => { day.style.setProperty("--sp-scale", String(scale)); return frame.offsetHeight <= avail; };
  if (fits(1)) return 1;
  if (!fits(MIN_SCALE)) { day.style.removeProperty("--sp-scale"); return null; }
  let lo = MIN_SCALE;
  let hi = 1;
  for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  day.style.setProperty("--sp-scale", lo.toFixed(3));
  return lo;
}

export function SheetFit() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".scale-print");
    if (!root) return;
    const days = () => [...root.querySelectorAll<HTMLElement>(".sp-day")];
    const fit = () => {
      root.classList.add("sp-measuring"); // mede na largura da folha (281 mm), não na largura da tela
      for (const day of days()) fitDayScale(day);
      root.classList.remove("sp-measuring");
    };
    const reset = () => days().forEach((day) => day.style.removeProperty("--sp-scale"));
    window.addEventListener("beforeprint", fit);
    window.addEventListener("afterprint", reset);
    return () => {
      window.removeEventListener("beforeprint", fit);
      window.removeEventListener("afterprint", reset);
    };
  }, []);
  return null;
}
