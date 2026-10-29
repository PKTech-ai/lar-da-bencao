"use client";

import "@/components/ingressos/ingressos.css";
import Link from "next/link";
import { ErrorBox, ShellProvider, Tabs, Top } from "@/components/ingressos/base";
import { Caixa, MinhasVendas } from "@/components/ingressos/caixa";
import { EventoForm, Eventos } from "@/components/ingressos/eventos";
import { Metas, Trabalhador } from "@/components/ingressos/metas";
import { Validar } from "@/components/ingressos/validar";
import { VendaDetalhe } from "@/components/ingressos/venda-detalhe";
import { Ajuda, TelaCompleta, VendaFeita, Vender } from "@/components/ingressos/vender";

/**
 * Módulo de Ingressos no celular. O mesmo app serve a Coordenação/Equipe (dentro do sistema, `/sistema/ingressos`)
 * e o trabalhador com acesso temporário (`/ingressos`, só Vender e Minhas vendas).
 */
export function IngressosApp({ mode, tela }: { mode: "user" | "seller"; tela: string[] }) {
  const base = mode === "user" ? "/sistema/ingressos" : "/ingressos";
  const [first = "", second] = tela;
  const tab = first === "" || first === "venda-feita" || first === "completa" || first === "ajuda" ? ""
    : first === "venda" ? (mode === "seller" ? "minhas" : "caixa")
    : first;

  return (
    <ShellProvider mode={mode} base={base}>
      {(ctx, error) => (
        <div className={`ing${mode === "seller" ? " ing-standalone" : ""}`}>
          <Top />
          <ErrorBox text={error} />
          {!ctx ? (error ? null : <p className="ing-muted">Carregando…</p>) : (
            <main style={{ minHeight: "60vh" }}>
              {first === "" ? (ctx.can["venda.criar"] || mode === "seller" ? <Vender /> : <Somente />)
                : first === "venda-feita" && second ? <VendaFeita id={second} />
                : first === "venda" && second ? <VendaDetalhe id={second} />
                : first === "completa" && mode === "user" ? <TelaCompleta />
                : first === "ajuda" ? <Ajuda />
                : first === "minhas" ? <MinhasVendas />
                : first === "validar" && mode === "user" ? <Validar />
                : first === "caixa" && mode === "user" ? <Caixa />
                : first === "metas" && mode === "user" ? (second ? <Trabalhador sellerId={second} /> : <Metas />)
                : first === "eventos" && mode === "user" ? (second === "novo" ? <EventoForm /> : second ? <EventoForm id={second} /> : <Eventos />)
                : <p className="ing-empty">Página não encontrada. <Link href={base}>Voltar ao início</Link></p>}
            </main>
          )}
          <Tabs current={tab} />
        </div>
      )}
    </ShellProvider>
  );
}

/** Quem só consulta (ex.: Diretoria) cai direto no caixa. */
function Somente() {
  return <p className="ing-empty">Seu perfil consulta o caixa. <Link href="/sistema/ingressos/caixa">Abrir Caixa</Link></p>;
}
