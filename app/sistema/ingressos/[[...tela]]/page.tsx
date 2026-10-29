import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IngressosApp } from "@/components/ingressos/app";
import { CaixaImpressao } from "@/components/ingressos/caixa-impressao";
import { FLAG, userRoleFor } from "@/lib/ingressos/acesso";
import { requireModulePage } from "@/lib/page-auth";
import { pageLevel } from "@/lib/permissions";

export const metadata: Metadata = { title: "Ingressos — Lar da Bênção" };

type Params = { params: Promise<{ tela?: string[] }>; searchParams: Promise<{ evento?: string }> };

/** Departamento de Eventos › Ingressos: Vender, Validar, Caixa, Metas e Eventos. */
export default async function IngressosPage({ params, searchParams }: Params) {
  const actor = await requireModulePage(FLAG, { resource: "department", department: "eventos" });
  const role = userRoleFor(await pageLevel(actor, "eventos"), actor.departments);
  if (!role) notFound();
  const { tela = [] } = await params;
  if (tela.length > 2) notFound();
  if (tela[0] === "caixa" && tela[1] === "imprimir") {
    if (role !== "coordenacao") notFound();
    return <CaixaImpressao actor={actor} eventId={(await searchParams).evento ?? null} />;
  }
  return <IngressosApp mode="user" tela={tela} />;
}
