"use client";

import { useRef, useState } from "react";
import { PAGE_HEIGHT_PX, SAFETY, fitDayScale } from "./sheet-fit";

// Gera no próprio aparelho um PDF com as mesmas folhas da impressão (A4 deitada, cada dia numa folha nova, nenhuma
// tabela cortada, cabeçalho repetido na folha de continuação) e abre o "Compartilhar" do celular (WhatsApp etc.).
// No computador, ou onde o aparelho não compartilha arquivo, o PDF é baixado.
const PAGE_W_MM = 297;
const MARGIN_MM = 8;
const CONTENT_W_MM = PAGE_W_MM - 2 * MARGIN_MM; // 281 mm
const CONTENT_H_MM = 210 - 2 * MARGIN_MM; // 194 mm

type State = "idle" | "working" | "ready";

export function SharePdfButton({ fileName, title }: { fileName: string; title: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const file = useRef<File | null>(null);

  async function onClick() {
    setMessage("");
    if (state === "ready" && file.current) return deliver(file.current);
    setState("working");
    try {
      file.current = await buildPdf(fileName);
    } catch (error) {
      console.error(error);
      setState("idle");
      setMessage("Não foi possível gerar o PDF. Tente de novo.");
      return;
    }
    setState("ready");
    await deliver(file.current);
  }

  async function deliver(pdf: File) {
    if (!shareable(pdf)) { download(pdf); return; }
    try {
      await navigator.share({ files: [pdf], title });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError") return; // fechou o Compartilhar sem escolher
      // O celular só abre o Compartilhar logo depois do toque; se o PDF demorou, pede um segundo toque.
      if (name === "NotAllowedError") { setMessage("PDF pronto. Toque em Enviar PDF."); return; }
      console.error(error);
      download(pdf);
    }
  }

  const label = state === "working" ? "Gerando PDF…" : state === "ready" ? "📲 Enviar PDF" : "📲 PDF para WhatsApp";
  return (
    <>
      <button type="button" className={`button no-print${state === "working" ? " is-loading" : ""}`} disabled={state === "working"} onClick={onClick}>{label}</button>
      {message ? <span role="status" className="small no-print" style={{ alignSelf: "center" }}>{message}</span> : null}
    </>
  );
}

function shareable(pdf: File) {
  // Só no celular/tablet (tela de toque): no computador o Compartilhar do sistema confunde mais do que ajuda.
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  try { return navigator.canShare({ files: [pdf] }); } catch { return false; }
}

function download(pdf: File) {
  const url = URL.createObjectURL(pdf);
  const link = document.createElement("a");
  link.href = url;
  link.download = pdf.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function buildPdf(fileName: string): Promise<File> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);
  await document.fonts?.ready;
  const days = [...document.querySelectorAll<HTMLElement>(".scale-print:not(.sp-pdf) .sp-day")];
  if (!days.length) throw new Error("Escala sem folhas para o PDF");
  // Palco fora da tela, na largura da folha (281 mm), com o estilo da impressão (classe sp-pdf no CSS da página).
  const stage = document.createElement("div");
  stage.className = "scale-print sp-pdf";
  stage.setAttribute("aria-hidden", "true");
  document.body.appendChild(stage);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  let pages = 0;
  try {
    for (const day of days) {
      for (const page of sheetsOf(day, stage)) {
        stage.replaceChildren(page);
        const canvas = await html2canvas(page, { scale: 2, backgroundColor: "#ffffff", logging: false });
        let w = CONTENT_W_MM;
        let h = (canvas.height / canvas.width) * w;
        if (h > CONTENT_H_MM) { w = (w * CONTENT_H_MM) / h; h = CONTENT_H_MM; } // uma seção sozinha maior que a folha
        if (pages++) pdf.addPage("a4", "landscape");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_MM + (CONTENT_W_MM - w) / 2, MARGIN_MM, w, h);
        canvas.width = 0; // libera a memória do desenho (celular tem pouca)
        canvas.height = 0;
      }
    }
  } finally {
    stage.remove();
  }
  return new File([pdf.output("blob")], fileName, { type: "application/pdf" });
}

/** As folhas de um dia: uma só (com a letra reduzida até 82% se preciso) ou, se não couber, várias com o cabeçalho
 *  repetido e as seções que couberem em cada uma, sem cortar tabela — como sai na impressão. */
function sheetsOf(day: HTMLElement, stage: HTMLElement): HTMLElement[] {
  const whole = day.cloneNode(true) as HTMLElement;
  whole.style.removeProperty("--sp-scale");
  stage.replaceChildren(whole);
  if (fitDayScale(whole) !== null) return [whole];
  const frame = whole.querySelector<HTMLElement>(".sp-frame");
  const blocks = [...whole.querySelectorAll<HTMLElement>(".sp-body > .sp-block")];
  if (!frame || blocks.length < 2) return [whole];
  const avail = PAGE_HEIGHT_PX * SAFETY;
  const groups: number[][] = [];
  let current: number[] = [];
  blocks.forEach((block) => { block.style.display = "none"; });
  blocks.forEach((block, i) => {
    block.style.display = "";
    if (current.length && frame.offsetHeight > avail) {
      current.forEach((j) => { blocks[j].style.display = "none"; });
      groups.push(current);
      current = [];
    }
    current.push(i);
  });
  groups.push(current);
  return groups.map((group) => {
    const sheet = day.cloneNode(true) as HTMLElement;
    sheet.style.removeProperty("--sp-scale");
    sheet.querySelectorAll(".sp-body > .sp-block").forEach((block, i) => { if (!group.includes(i)) block.remove(); });
    return sheet;
  });
}
