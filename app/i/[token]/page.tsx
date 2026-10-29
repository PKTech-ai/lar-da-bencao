/* eslint-disable @next/next/no-img-element -- QR gerado na hora (data:) e logo da API própria */
import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import "@/components/ingressos/ingressos.css";
import { QR_PREFIX, manausDateTime, mealWithArticle, shortDate, weekday } from "@/lib/ingressos/regras";
import { publicTickets } from "@/lib/ingressos/publico";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seus ingressos", robots: { index: false, follow: false } };

function Message({ title, logo }: { title: string; logo?: string }) {
  return (
    <div className="ing ing-standalone">
      <div className="ing-empty" style={{ paddingTop: 60 }}>
        <img src={logo ?? "/marca-lar-da-bencao.png"} alt="" width={96} height={96} style={{ justifySelf: "center", objectFit: "contain" }} />
        <h1 style={{ fontSize: 24, color: "var(--blue-900)" }}>{title}</h1>
      </div>
    </div>
  );
}

/** Página pública dos ingressos (RF-16): QR e código grandes; nunca valores nem dados pessoais. */
export default async function TicketsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const ip = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const data = await publicTickets(token, ip);
  if (data.state === "invalido") return <Message title="Link não encontrado. Confira com quem vendeu." />;
  if (data.state === "passou") return <Message title="Este evento já aconteceu." />;
  if (data.state === "cancelado") return <Message title="Ingressos cancelados. Fale com quem vendeu." logo={data.logo_url} />;
  const qrs = await Promise.all(data.tickets.map((t) => QRCode.toDataURL(`${QR_PREFIX}${t.token}`, { margin: 1, width: 360, errorCorrectionLevel: "M" })));
  const n = data.tickets.length;

  return (
    <div className="ing ing-standalone">
      <header className="ing-top">
        <img src={data.logo_url} alt="" />
        <div className="ing-top-text"><strong>{data.organizer_name}</strong><span>{data.event_name}</span></div>
      </header>
      <h1 className="ing-question">{n === 1 ? "Seu ingresso" : `Seus ${n} ingressos`}, {data.first_name}</h1>
      <p style={{ fontSize: 18 }}>
        <b>{data.event_name}</b><br />
        {weekday(data.event_date)}, {shortDate(data.event_date, true)}{data.event_time ? ` às ${data.event_time}` : ""}{data.place ? ` · ${data.place}` : ""}
      </p>
      {data.tickets.map((t, i) => (
        <section key={t.code} className="ing-card" style={{ justifyItems: "center", textAlign: "center", opacity: t.delivered_at ? 0.55 : 1 }}>
          <small className="ing-muted">Ingresso {t.number} de {n}</small>
          <img src={qrs[i]} alt={`QR do ingresso ${t.code}`} width={260} height={260} style={{ background: "#fff", borderRadius: 12 }} />
          <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: 8, fontFamily: "ui-monospace, Consolas, monospace" }}>{t.code}</span>
          {t.delivered_at ? <b style={{ color: "var(--danger)", fontSize: 18 }}>Utilizado em {manausDateTime(t.delivered_at).date} às {manausDateTime(t.delivered_at).time}</b> : null}
        </section>
      ))}
      <p className="ing-muted" style={{ textAlign: "center", fontSize: 16, paddingBottom: 24 }}>
        Mostre o QR ou o código na hora de retirar. Cada ingresso vale {mealWithArticle(data.kind, false)}.
      </p>
    </div>
  );
}
