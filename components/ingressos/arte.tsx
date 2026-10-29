"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { EventInfo } from "@/components/ingressos/base";
import { PIX_KEY_LABEL, formatBRL, formatCnpj, formatWhatsapp, pixPayload, shortDate, weekday, type EventKind } from "@/lib/ingressos/regras";

/**
 * Arte de divulgação (RF-03), desenhada no navegador: Status/Story 1080×1920 e Feed 1080×1080 (PNG).
 * Textos longos diminuem até caber; se ainda não couberem, quebram em até 3 linhas. Nada é cortado.
 */
const PALETTE: Record<EventKind, { bg: string; band: string; accent: string }> = {
  feijoada: { bg: "#FFF6EC", band: "#7A2E12", accent: "#B4521C" },
  cafe_da_manha: { bg: "#FFF9EF", band: "#8A5A2B", accent: "#C98A3A" },
  almoco: { bg: "#F4F7F1", band: "#2F5D3A", accent: "#5E8C4A" },
  outro: { bg: "#F1F7FA", band: "#285870", accent: "#356F8F" }
};
const FONT = 'Arial, "Segoe UI", sans-serif';
const TEXT = "#2a2a2a";

type Format = { key: "story" | "feed"; label: string; width: number; height: number };
const FORMATS: Format[] = [
  { key: "story", label: "Status / Story", width: 1080, height: 1920 },
  { key: "feed", label: "Feed / Grupos", width: 1080, height: 1080 }
];

function wrap(ctx: CanvasRenderingContext2D, text: string, size: number, weight: number, maxWidth: number) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width <= maxWidth || !line) line = attempt;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Maior fonte em que o texto cabe: primeiro numa linha só; depois em até 3 linhas. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, opts: { size: number; min: number; weight: number; maxWidth: number; maxLines?: number }) {
  const fits = (lines: string[], size: number) => {
    ctx.font = `${opts.weight} ${size}px ${FONT}`;
    return lines.every((l) => ctx.measureText(l).width <= opts.maxWidth);
  };
  for (let size = opts.size; size >= opts.min; size -= 2) {
    if (fits([text], size)) return { size, lines: [text] };
  }
  for (let size = opts.size; size >= Math.round(opts.min * 0.6); size -= 2) {
    const lines = wrap(ctx, text, size, opts.weight, opts.maxWidth);
    if (lines.length <= (opts.maxLines ?? 3) && fits(lines, size)) return { size, lines };
  }
  const size = Math.round(opts.min * 0.6);
  return { size, lines: wrap(ctx, text, size, opts.weight, opts.maxWidth) };
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

export async function drawArt(canvas: HTMLCanvasElement, event: EventInfo, format: Format) {
  const { width: W, height: H } = format;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const colors = PALETTE[event.kind];
  const story = format.key === "story";
  const pad = story ? 80 : 60;
  const inner = W - pad * 2;
  const [logo, qr] = await Promise.all([
    loadImage(event.logo_url).catch(() => null),
    QRCode.toDataURL(pixPayload({ keyType: event.pix_key_type, key: event.pix_key, receiver: event.pix_receiver, city: event.pix_city }), { margin: 1, width: 600, errorCorrectionLevel: "M" }).then(loadImage)
  ]);

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);

  // Faixa do topo: logo em círculo + organizador e CNPJ.
  const bandH = story ? 300 : 200;
  ctx.fillStyle = colors.band;
  ctx.fillRect(0, 0, W, bandH);
  const logoD = story ? 190 : 130;
  const logoX = pad;
  const logoY = (bandH - logoD) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(logoX + logoD / 2, logoY + logoD / 2, logoD / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.clip();
  if (logo) {
    const s = Math.min((logoD * 0.86) / logo.width, (logoD * 0.86) / logo.height);
    ctx.drawImage(logo, logoX + (logoD - logo.width * s) / 2, logoY + (logoD - logo.height * s) / 2, logo.width * s, logo.height * s);
  }
  ctx.restore();
  const orgX = logoX + logoD + 32;
  const orgW = W - orgX - pad;
  const org = fitText(ctx, event.organizer_name, { size: story ? 54 : 42, min: 30, weight: 700, maxWidth: orgW, maxLines: 2 });
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const orgBlock = org.lines.length * org.size * 1.15 + (story ? 44 : 36);
  let y = (bandH - orgBlock) / 2;
  ctx.font = `700 ${org.size}px ${FONT}`;
  for (const line of org.lines) { ctx.fillText(line, orgX, y); y += org.size * 1.15; }
  ctx.font = `400 ${story ? 32 : 26}px ${FONT}`;
  ctx.globalAlpha = 0.9;
  ctx.fillText(`CNPJ ${formatCnpj(event.organizer_cnpj)}`, orgX, y + 6);
  ctx.globalAlpha = 1;

  // Corpo: nome, finalidade, quando/onde, valor; depois o bloco Pix e as reservas.
  const when = `${weekday(event.event_date)}, ${shortDate(event.event_date, true)}${event.event_time ? ` às ${event.event_time}` : ""}`;
  const reservations = event.reservations_whatsapp ?? event.organizer_whatsapp;
  const pixH = story ? 560 : 330;
  const footerH = reservations ? (story ? 90 : 60) : 0;
  const bodyTop = bandH + (story ? 70 : 36);
  const bodyBottom = H - pad - pixH - footerH - (story ? 40 : 20);

  let scale = 1;
  type Block = { text: string; size: number; min: number; weight: number; color: string; gap: number; maxLines?: number };
  const blocks = (k: number): Block[] => [
    { text: event.name, size: (story ? 128 : 86) * k, min: (story ? 72 : 50) * k, weight: 900, color: colors.accent, gap: story ? 30 : 16, maxLines: 3 },
    { text: event.purpose, size: (story ? 54 : 38) * k, min: (story ? 36 : 26) * k, weight: 400, color: TEXT, gap: story ? 44 : 20, maxLines: 3 },
    { text: when, size: (story ? 52 : 38) * k, min: (story ? 34 : 26) * k, weight: 700, color: TEXT, gap: event.place ? 10 : (story ? 40 : 18) },
    ...(event.place ? [{ text: event.place, size: (story ? 46 : 34) * k, min: (story ? 30 : 24) * k, weight: 400, color: TEXT, gap: story ? 40 : 18 }] : []),
    { text: `${formatBRL(event.price_cents)} por ticket`, size: (story ? 84 : 60) * k, min: (story ? 50 : 40) * k, weight: 900, color: colors.band, gap: 0 }
  ];
  let laid = blocks(scale).map((b) => ({ ...b, ...fitText(ctx, b.text, { size: b.size, min: b.min, weight: b.weight, maxWidth: inner, maxLines: b.maxLines }) }));
  const height = (items: typeof laid) => items.reduce((s, b) => s + b.lines.length * b.size * 1.18 + b.gap, 0);
  while (height(laid) > bodyBottom - bodyTop && scale > 0.5) {
    scale -= 0.05;
    laid = blocks(scale).map((b) => ({ ...b, ...fitText(ctx, b.text, { size: b.size, min: b.min, weight: b.weight, maxWidth: inner, maxLines: b.maxLines }) }));
  }
  y = bodyTop + Math.max(0, (bodyBottom - bodyTop - height(laid)) / 2);
  ctx.textAlign = "center";
  for (const b of laid) {
    ctx.font = `${b.weight} ${b.size}px ${FONT}`;
    ctx.fillStyle = b.color;
    for (const line of b.lines) { ctx.fillText(line, W / 2, y); y += b.size * 1.18; }
    y += b.gap;
  }

  // Bloco Pix: QR estático sem valor + chave.
  const pixTop = H - pad - pixH - footerH;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, pad, pixTop, inner, pixH, 36);
  ctx.fill();
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  const qrSize = pixH - (story ? 120 : 60);
  if (story) {
    ctx.drawImage(qr, (W - qrSize) / 2, pixTop + 24, qrSize, qrSize);
    const key = fitText(ctx, `Pix (${PIX_KEY_LABEL[event.pix_key_type]}): ${event.pix_key}`, { size: 40, min: 24, weight: 700, maxWidth: inner - 60, maxLines: 2 });
    ctx.fillStyle = TEXT;
    ctx.font = `700 ${key.size}px ${FONT}`;
    let ky = pixTop + 24 + qrSize + 14;
    for (const line of key.lines) { ctx.fillText(line, W / 2, ky); ky += key.size * 1.15; }
  } else {
    ctx.drawImage(qr, pad + 30, pixTop + 30, qrSize, qrSize);
    const textX = pad + 30 + qrSize + 36;
    const textW = W - pad - 30 - textX;
    ctx.textAlign = "left";
    ctx.fillStyle = colors.band;
    ctx.font = `900 44px ${FONT}`;
    ctx.fillText("Pague no Pix", textX, pixTop + 60);
    const key = fitText(ctx, `${PIX_KEY_LABEL[event.pix_key_type]}: ${event.pix_key}`, { size: 34, min: 22, weight: 700, maxWidth: textW, maxLines: 3 });
    ctx.fillStyle = TEXT;
    ctx.font = `700 ${key.size}px ${FONT}`;
    let ky = pixTop + 130;
    for (const line of key.lines) { ctx.fillText(line, textX, ky); ky += key.size * 1.2; }
    ctx.textAlign = "center";
  }

  if (reservations) {
    ctx.fillStyle = colors.band;
    ctx.font = `700 ${story ? 48 : 36}px ${FONT}`;
    ctx.fillText(`Reservas: ${formatWhatsapp(reservations)}`, W / 2, H - pad - footerH + (story ? 30 : 16));
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const fileName = (event: EventInfo, format: Format) =>
  `${event.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${format.key}.png`;

export function ArteEvento({ event }: { event: EventInfo }) {
  return (
    <div className="ing-card">
      <h3>Arte de divulgação</h3>
      <p className="ing-muted">Gerada com os dados do evento. Muda sozinha quando o evento ou o organizador muda.</p>
      {FORMATS.map((f) => <ArtFormat key={`${f.key}-${event.version}`} event={event} format={f} />)}
    </div>
  );
}

function ArtFormat({ event, format }: { event: EventInfo; format: Format }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (canvas.current) drawArt(canvas.current, event, format).catch(() => setError("Não foi possível gerar a arte."));
  }, [event, format]);

  const blob = () => new Promise<Blob | null>((resolve) => canvas.current?.toBlob(resolve, "image/png") ?? resolve(null));
  async function download() {
    const b = await blob();
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName(event, format);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function share() {
    const b = await blob();
    if (!b) return;
    const file = new File([b], fileName(event, format), { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: event.name }); } catch { /* cancelado */ }
    } else await download();
  }

  return (
    <div className="ing-step" style={{ gap: 8 }}>
      <b>{format.label} ({format.width} × {format.height})</b>
      <canvas ref={canvas} style={{ width: format.key === "story" ? "60%" : "100%", height: "auto", borderRadius: 12, border: "1px solid var(--line)", justifySelf: "center" }}
        role="img" aria-label={`Arte ${format.label} do evento ${event.name}`} />
      {error ? <div className="error">{error}</div> : null}
      <div className="ing-row">
        <button type="button" className="ing-btn small" onClick={download}>Baixar imagem</button>
        <button type="button" className="ing-btn small" onClick={share}>Compartilhar</button>
      </div>
    </div>
  );
}
