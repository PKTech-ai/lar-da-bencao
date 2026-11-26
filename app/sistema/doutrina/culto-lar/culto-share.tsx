"use client";

import { useState } from "react";
import { cultoWhatsappMessage } from "@/lib/culto-convite";

/**
 * Link do Culto no Lar para o grupo do WhatsApp: cada ano tem o seu link fixo (gerado pelo sistema). O trabalhador
 * abre, escolhe um sábado livre e digita o nome; aparece na hora na programação abaixo.
 */
export function CultoShare({ links, initialYear }: { links: { year: number; url: string }[]; initialYear: number }) {
  const [year, setYear] = useState(initialYear);
  const [copied, setCopied] = useState("");
  const url = links.find((l) => l.year === year)?.url ?? links[0]?.url ?? "";
  const message = cultoWhatsappMessage(year, url);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      window.prompt("Copie o texto abaixo:", text);
    }
  }

  return (
    <section className="card no-print" aria-labelledby="culto-share-title" style={{ marginBottom: 16 }}>
      <div className="module-section-head" style={{ marginBottom: 8 }}>
        <div>
          <h3 id="culto-share-title" style={{ margin: 0 }}>Link para o grupo do WhatsApp</h3>
          <p className="small muted" style={{ margin: "4px 0 0" }}>Os trabalhadores abrem o link, escolhem um sábado livre e digitam o nome. Pelo link não dá para trocar nem apagar: isso só aqui.</p>
        </div>
        {links.length > 1 ? (
          <select aria-label="Ano do link" value={year} onChange={(e) => { setYear(Number(e.target.value)); setCopied(""); }} style={{ width: "auto" }}>
            {links.map((l) => <option key={l.year} value={l.year}>{l.year}</option>)}
          </select>
        ) : null}
      </div>
      <input readOnly value={url} aria-label={`Link do Culto no Lar de ${year}`} onFocus={(e) => e.currentTarget.select()} />
      <div className="row-actions" style={{ marginTop: 10 }}>
        <a className="button primary" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Enviar no WhatsApp</a>
        <button type="button" className="button" onClick={() => void copy(message, "convite")}>Copiar convite</button>
        <button type="button" className="button" onClick={() => void copy(url, "link")}>Copiar só o link</button>
        <a className="button" href={url} target="_blank" rel="noopener noreferrer">Ver a página</a>
      </div>
      {copied ? <p className="small success" role="status" style={{ marginTop: 10 }}>{copied === "convite" ? "Convite copiado. É só colar no grupo do WhatsApp." : "Link copiado."}</p> : null}
      <details style={{ marginTop: 10 }}>
        <summary className="small">Ver o texto do convite</summary>
        <pre className="small" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: "8px 0 0" }}>{message}</pre>
      </details>
    </section>
  );
}
