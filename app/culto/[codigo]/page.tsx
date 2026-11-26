import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { CULTO_CONVITE, CULTO_CONVITE_HORARIO, CULTO_VERSICULO, CULTO_VERSICULO_FONTE } from "@/lib/culto-convite";
import { CULTO_LINK_FLAG, cultoLinkYear, loadCultoPublicYear } from "@/lib/culto-link";
import { isFlagEnabled } from "@/lib/feature-flags";
import { CultoPublico } from "./culto-publico";
import "./culto.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Culto no Lar dos Trabalhadores — Lar da Bênção", robots: { index: false, follow: false } };

/** Página pública do link do Culto no Lar (postado no grupo do WhatsApp): escolher um sábado livre digitando o nome. */
export default async function CultoLinkPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const year = (await isFlagEnabled(CULTO_LINK_FLAG)) ? cultoLinkYear(codigo) : null;
  const months = year ? await loadCultoPublicYear(year) : [];

  return (
    <main className="auth-shell culto-public">
      <section className="auth-card" aria-labelledby="culto-title">
        <Brand />
        {year ? (
          <>
            <h1 id="culto-title">Culto no Lar dos Trabalhadores — {year}</h1>
            <p>{CULTO_CONVITE}</p>
            <blockquote className="culto-verse">{CULTO_VERSICULO} <cite>({CULTO_VERSICULO_FONTE})</cite></blockquote>
            <p className="notice">Um culto por mês, sempre no <strong>penúltimo sábado</strong>, das <strong>{CULTO_CONVITE_HORARIO}</strong>. Toque em um sábado livre e digite o seu nome.</p>
            <CultoPublico code={codigo} months={months} />
          </>
        ) : (
          <>
            <h1 id="culto-title">Link não encontrado</h1>
            <div className="notice" role="status">Confira se o link foi copiado inteiro ou peça o link novo à Doutrina do Lar da Bênção.</div>
          </>
        )}
      </section>
    </main>
  );
}
